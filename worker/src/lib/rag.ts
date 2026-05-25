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
  queryVector: number[],
  course?: string,
  topK = 5
): Promise<RetrievedChunk[]> {
  const filter = course ? { course: { $eq: course } } : undefined;
  const r = await vectorize.query(queryVector, {
    topK,
    returnMetadata: "all",
    filter,
  });
  return r.matches.map((m) => {
    const md = m.metadata as Record<string, unknown>;
    return {
      text: String(md.text ?? ""),
      pdf: String(md.pdf ?? ""),
      page_start: Number(md.page_start ?? 0),
      page_end: Number(md.page_end ?? 0),
      score: m.score,
    };
  });
}

export function buildPrompt(
  question: string,
  selectedText: string | undefined,
  chunks: RetrievedChunk[]
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

  return `Sen bir Türk hukuku asistanısın. AÜHF müfredatına hakimsin (Borçlar Özel, Miras, Eşya, İş, Vergi, Ticaret, Deniz, Kıymetli Evrak, İdari Yargı, Ceza Muhakemesi, Medeni Usul, İcra İflas, MÖHUK, Genel Kamu).

Aşağıdaki kaynak metinlerden yararlanarak SADECE Türkçe, net ve öz cevap ver. Hukuki kavramları doğru kullan. Cevabında bilgi alındığı yerleri [1], [2] şeklinde numaralarla işaret et.

KAYNAKLAR:
${context}
${sel}
KULLANICININ SORUSU:
${question}

CEVAP:`;
}
