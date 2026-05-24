import { Hono } from "hono";

type Bindings = { PDF_BUCKET: R2Bucket };

export const pdf = new Hono<{ Bindings: Bindings }>();

// List objects under optional prefix
pdf.get("/list", async (c) => {
  const prefix = c.req.query("prefix") ?? "";
  const cursor = c.req.query("cursor");
  const list = await c.env.PDF_BUCKET.list({
    prefix,
    limit: 1000,
    cursor: cursor ?? undefined,
  });
  return c.json({
    objects: list.objects.map((o) => ({
      key: o.key,
      size: o.size,
      uploaded: o.uploaded.toISOString(),
    })),
    truncated: list.truncated,
    cursor: list.truncated ? list.cursor : null,
  });
});

// Stream a PDF object
pdf.get("/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const obj = await c.env.PDF_BUCKET.get(key);
  if (!obj) return c.notFound();

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("Cache-Control", "public, max-age=86400");
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/pdf");
  }
  return new Response(obj.body, { headers });
});
