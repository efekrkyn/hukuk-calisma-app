import { Hono } from "hono";

type ChunkIn = {
  id: string;
  course: string;
  pdf: string;
  page_start: number;
  page_end: number;
  text: string;
};

type Bindings = {
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  DB: D1Database;
  ADMIN_SECRET: string;
};

export const admin = new Hono<{ Bindings: Bindings }>();

admin.use("*", async (c, next) => {
  const auth = c.req.header("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token !== c.env.ADMIN_SECRET) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
});

const AI_BATCH = 32; // bge-m3 önerilen batch
const MAX_TEXT_CHARS = 4000; // ~1000 token, güvenli marj
const VECTORIZE_BATCH = 1000; // upsert limit

/**
 * PDF metin çıkarımının bıraktığı, embedding modelinin reddettiği baytları temizler.
 *
 * pdf-parse taranmış/bozuk sayfalardan eşleşmemiş surrogate ve C0/C1 kontrol
 * karakterleri üretebiliyor; bge-m3 bunları içeren partinin TAMAMINI
 * "3030: invalid input" ile reddediyor.
 */
export function sanitizeText(s: string): string {
  return s
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, " ")  // yalnız yüksek surrogate
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, " ")  // yalnız düşük surrogate
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, " ")
    .replace(/\uFFFD/g, " ")                                // replacement char
    .replace(/\s+/g, " ");
}

admin.post("/embed", async (c) => {
  let body: { chunks: ChunkIn[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }
  const chunks = body.chunks ?? [];
  if (chunks.length === 0) return c.json({ ok: true, count: 0 });
  if (chunks.length > 200) {
    return c.json({ error: "max 200 chunks per request" }, 400);
  }

  // PDF metin çıkarımı kontrol karakteri ve eşleşmemiş surrogate üretebiliyor;
  // bunlar bge-m3'e "3030: invalid input" dedirtiyor. Temizle, kırp, boşları at.
  const safeChunks = chunks
    .map((ch) => ({ ...ch, text: sanitizeText(ch.text ?? "").slice(0, MAX_TEXT_CHARS).trim() }))
    .filter((ch) => ch.text.length > 0);

  const skipped = chunks.length - safeChunks.length;
  if (safeChunks.length === 0) return c.json({ ok: true, count: 0, skipped });

  // AI embeddings. Tek bozuk chunk TÜM partiyi düşürüyor ve 17 bin chunk'lık
  // ingest ortada kalıyordu — parti patlarsa tek tek dene, sadece gerçekten
  // bozuk olanı ele. Vektörler chunk'larla hizalı kalmalı, o yüzden çift tut.
  const paired: Array<{ ch: (typeof safeChunks)[number]; vec: number[] }> = [];
  const failedTexts: string[] = [];

  async function embed(texts: string[]): Promise<number[][]> {
    const r = (await c.env.AI.run("@cf/baai/bge-m3", { text: texts })) as {
      data: number[][];
    };
    if (!r.data || r.data.length !== texts.length) {
      throw new Error(`AI count mismatch: ${r.data?.length ?? 0}/${texts.length}`);
    }
    return r.data;
  }

  for (let i = 0; i < safeChunks.length; i += AI_BATCH) {
    const slice = safeChunks.slice(i, i + AI_BATCH);
    try {
      const vecs = await embed(slice.map((ch) => ch.text));
      slice.forEach((ch, k) => paired.push({ ch, vec: vecs[k] }));
    } catch {
      for (const ch of slice) {
        try {
          const [vec] = await embed([ch.text]);
          paired.push({ ch, vec });
        } catch (e) {
          failedTexts.push(`${ch.pdf}#${ch.id}: ${String(e).slice(0, 120)}`);
        }
      }
    }
  }

  if (paired.length === 0) {
    return c.json(
      { error: "AI.run failed", failed: failedTexts.slice(0, 5) },
      502
    );
  }

  // Vectorize upsert (batches of 1000)
  try {
    const vectors = paired.map(({ ch, vec }) => ({
      id: ch.id,
      values: vec,
      metadata: {
        course: ch.course,
        pdf: ch.pdf,
        page_start: ch.page_start,
        page_end: ch.page_end,
        text: ch.text.slice(0, 2000), // metadata limit
      },
    }));
    for (let i = 0; i < vectors.length; i += VECTORIZE_BATCH) {
      const slice = vectors.slice(i, i + VECTORIZE_BATCH);
      await c.env.VECTORIZE.upsert(slice);
    }
  } catch (e) {
    return c.json(
      { error: "Vectorize.upsert failed", detail: String(e).slice(0, 500) },
      500
    );
  }

  // D1 FTS5 Insert (Batch)
  try {
    const stmt = c.env.DB.prepare(
      `INSERT INTO fts_chunks (id, course, pdf, page_start, page_end, text) VALUES (?, ?, ?, ?, ?, ?)`
    );
    const batchStmts = paired.map(({ ch }) =>
      stmt.bind(ch.id, ch.course, ch.pdf, ch.page_start, ch.page_end, ch.text)
    );
    
    // Execute D1 batch
    await c.env.DB.batch(batchStmts);
  } catch (e) {
    console.error("D1 FTS5 Insert failed", e);
    // Continue even if D1 fails, vectorize succeeded
  }

  return c.json({
    ok: true,
    count: paired.length,
    skipped,
    failed: failedTexts.length,
    failed_samples: failedTexts.slice(0, 3),
  });
});

admin.get("/vectorize-info", async (c) => {
  return c.json({
    note: "Use `wrangler vectorize info hukuk-vectors` for accurate count",
  });
});
