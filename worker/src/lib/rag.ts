/**
 * RAG (Retrieval-Augmented Generation) helpers.
 *
 * Tüm embeddings Cloudflare Workers AI @cf/baai/bge-m3 (1024-dim, multilingual)
 * üzerinden üretilir — kullanıcı sorgusunu da aynı modelle embed ederiz.
 */

export type RetrievedChunk = {
  text: string;
  pdf: string;
  page_start: number;
  page_end: number;
  score: number;
};

export async function embedQuery(query: string, ai: Ai): Promise<number[]> {
  const r = (await ai.run("@cf/baai/bge-m3", { text: [query] })) as {
    data: number[][];
  };
  if (!r.data?.[0]) throw new Error("embed query: empty response");
  return r.data[0];
}

export async function retrieve(
  vectorize: VectorizeIndex,
  db: D1Database | undefined,
  queryText: string,
  queryVector: number[],
  ai: Ai,
  course?: string | string[],
  topK = 5
): Promise<RetrievedChunk[]> {
  let filter: any = undefined;
  if (course) {
    if (Array.isArray(course)) {
      filter = { course: { $in: course } };
    } else {
      filter = { course: { $eq: course } };
    }
  }

  // 1) Vector Search
  const vecPromise = vectorize.query(queryVector, {
    topK,
    returnMetadata: "all",
    filter,
  }).catch((e) => {
    console.error("Vectorize query failed", e);
    return { matches: [] };
  });

  // 2) FTS5 Search (BM25 Keyword)
  let ftsPromise: Promise<{ results: any[] }> = Promise.resolve({ results: [] });
  if (db) {
    // Basic FTS syntax formatting: remove punctuation, join with OR
    const cleanQuery = queryText.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ0-9\s]/g, " ").trim();
    const ftsWords = cleanQuery.split(/\s+/).filter(w => w.length > 2);
    if (ftsWords.length > 0) {
      const ftsQuery = ftsWords.join(" OR ");
      
      let ftsSql = `SELECT id, course, pdf, page_start, page_end, text, bm25(fts_chunks) as score FROM fts_chunks WHERE fts_chunks MATCH ?`;
      const params: any[] = [ftsQuery];
      
      if (course) {
        if (Array.isArray(course)) {
          const placeholders = course.map(() => '?').join(',');
          ftsSql += ` AND course IN (${placeholders})`;
          params.push(...course);
        } else {
          ftsSql += ` AND course = ?`;
          params.push(course);
        }
      }
      ftsSql += ` ORDER BY score LIMIT ?`;
      params.push(topK);
      
      ftsPromise = db.prepare(ftsSql).bind(...params).all().catch(e => {
        console.error("FTS5 query failed", e);
        return { results: [] };
      });
    }
  }

  const [vecRes, ftsRes] = await Promise.all([vecPromise, ftsPromise]);

  const combined = new Map<string, RetrievedChunk>();

  // Add Vector results
  for (const m of vecRes.matches) {
    const md = m.metadata as Record<string, unknown>;
    if (!m.id) continue;
    combined.set(m.id, {
      text: String(md.text ?? ""),
      pdf: String(md.pdf ?? ""),
      page_start: Number(md.page_start ?? 0),
      page_end: Number(md.page_end ?? 0),
      score: m.score, // Vector score usually 0-1
    });
  }

  // Add FTS results (merge and prioritize)
  // BM25 score is usually negative (more negative = better) in SQLite FTS5! 
  // We'll just add them to the mix if they don't exist, or boost existing ones.
  for (const row of ftsRes.results) {
    const id = String(row.id);
    if (!combined.has(id)) {
      combined.set(id, {
        text: String(row.text ?? ""),
        pdf: String(row.pdf ?? ""),
        page_start: Number(row.page_start ?? 0),
        page_end: Number(row.page_end ?? 0),
        score: 0.9, // Artificial high score for exact matches
      });
    } else {
      const existing = combined.get(id)!;
      existing.score = existing.score + 0.2; // Boost
      combined.set(id, existing);
    }
  }

  // Top-K büyüt: önce 20 candidate al, sonra reranker'la topK'ye indir
  const candidates = Array.from(combined.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(topK * 4, 20)); // ~20 candidate

  if (candidates.length <= topK) return candidates;

  try {
    const rerankResult = (await ai.run("@cf/baai/bge-reranker-base", {
      query: queryText,
      contexts: candidates.map((c) => ({ text: c.text })),
    })) as { response: Array<{ id: number; score: number }> };

    if (!rerankResult?.response?.length) {
      return candidates.slice(0, topK);
    }

    // Reranker'ın döndürdüğü sıra ile candidates'i yeniden düzenle
    const reranked = rerankResult.response
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((r) => ({ ...candidates[r.id], score: r.score }))
      .filter((c) => c.text); // güvenlik: geçersiz id'leri ele

    return reranked.length > 0 ? reranked : candidates.slice(0, topK);
  } catch (e) {
    console.error("Reranker failed, falling back to original order:", e);
    return candidates.slice(0, topK);
  }
}

export type PromptMode = "default" | "law";

// Removed unused buildPrompt

export function buildSystemPrompt(
  selectedText: string | undefined,
  chunks: RetrievedChunk[],
  mode: PromptMode = "default",
  webSearchResults?: string
): string {
  const context = chunks
    .map(
      (c, i) =>
        `[${i + 1}] ${c.pdf} (s.${c.page_start}-${c.page_end}):\n${c.text}`
    )
    .join("\n\n");

  const sel = selectedText
    ? `\nKULLANICININ PDF'DEN SEÇTİĞİ METİN:\n"""${selectedText}"""\n`
    : "";

  if (mode === "law") {
    return `[ROLE: Turkish Law Assistant | TARGET: Law Student (AUHF 4th yr, Finals/HMGS) | CONTEXT: Reading Law Texts]

<SYNTH_RULES>
1. [SIMPLIFY] Explain in plain Turkish first -> Map to legal jargon (lex, ratio, etc. with definition).
2. [DECONSTRUCT] Break down articles: conditions of application, exceptions.
3. [EXEMPLIFY] MANDATORY: Provide a concrete, real-world Turkish case study ("Örn: Ali ve Veli...").
4. [LINK] Connect with other related articles (e.g., TBK 49 -> TMK 24).
5. [FORMAT] Use bolding, lists, tables.
6. [CITE] Use [1], [2] for provided SOURCES.
7. [REASON_FIRST] CRITICAL: For True/False or deductions, output Step-by-step Analysis FIRST -> Output "NET CEVAP: X" LAST. Never prefix conclusions.
8. [STRICT_RAG] Rely ONLY on SOURCES or WEB_SEARCH. IF NOT_FOUND -> Output "Not found in sources". DO NOT HALLUCINATE.
</SYNTH_RULES>

<SOURCES>
${context}
</SOURCES>
${sel}${webSearchResults ? `\n<WEB_SEARCH>\n${webSearchResults}\n</WEB_SEARCH>` : ""}
<QUESTION>
`;
  }

  return `[ROLE: Turkish Law Assistant | TARGET: Law Student (AUHF 4th yr, Finals/HMGS)]

<SYNTH_RULES>
1. [STYLE] Concise, clear, Turkish.
2. [JARGON] Accurate legal terms with brief definitions if needed.
3. [CITE] Cite provided sources [1], [2] and legal articles (e.g. TBK m.49).
4. [STRICT_RAG] Base answers ONLY on <SOURCES> or <WEB_SEARCH>. If missing, say "Not found". NO HALLUCINATION.
5. [EXEMPLIFY] Give a short practical example if applicable.
6. [REASON_FIRST] CRITICAL: Step-by-step analysis BEFORE conclusion. Ends with "NET CEVAP: X".
</SYNTH_RULES>

<SOURCES>
${context}
</SOURCES>
${sel}${webSearchResults ? `\n<WEB_SEARCH>\n${webSearchResults}\n</WEB_SEARCH>` : ""}
`;
}

