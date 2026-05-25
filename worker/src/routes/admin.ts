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

  // Text uzunluğu cap'le (safety)
  const safeChunks = chunks.map((ch) => ({
    ...ch,
    text: (ch.text ?? "").slice(0, MAX_TEXT_CHARS),
  }));

  // AI embeddings (multiple batches if large)
  const allVectors: number[][] = [];
  try {
    for (let i = 0; i < safeChunks.length; i += AI_BATCH) {
      const slice = safeChunks.slice(i, i + AI_BATCH);
      const r = (await c.env.AI.run("@cf/baai/bge-m3", {
        text: slice.map((ch) => ch.text),
      })) as { data: number[][] };
      if (!r.data || r.data.length !== slice.length) {
        return c.json(
          {
            error: "AI count mismatch",
            expected: slice.length,
            got: r.data?.length ?? 0,
            batch_offset: i,
          },
          500
        );
      }
      allVectors.push(...r.data);
    }
  } catch (e) {
    return c.json(
      { error: "AI.run failed", detail: String(e).slice(0, 500) },
      502
    );
  }

  // Vectorize upsert (batches of 1000)
  try {
    const vectors = safeChunks.map((ch, i) => ({
      id: ch.id,
      values: allVectors[i],
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

  return c.json({ ok: true, count: safeChunks.length });
});

admin.get("/vectorize-info", async (c) => {
  return c.json({
    note: "Use `wrangler vectorize info hukuk-vectors` for accurate count",
  });
});
