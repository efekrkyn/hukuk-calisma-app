import { Hono } from "hono";

type Bindings = { PDF_BUCKET: R2Bucket };

export const pdf = new Hono<{ Bindings: Bindings }>();

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_MIME = new Set(["application/pdf"]);

// Path traversal koruması: dosya adından sadece basename'i al,
// tehlikeli karakterleri ayıkla, uzantıyı zorla .pdf yap.
function sanitizeFilename(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "file.pdf";
  const cleaned = base.replace(/[^\w.\-]+/g, "_").replace(/^\.+/, "");
  const withoutExt = cleaned.replace(/\.pdf$/i, "");
  const trimmed = withoutExt.slice(0, 120) || "file";
  return `${trimmed}.pdf`;
}

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

// Upload a personal PDF
pdf.post("/upload", async (c) => {
  // Content-Length pre-check (formData parse'tan önce hızlı reject).
  const cl = c.req.header("content-length");
  if (cl && Number(cl) > MAX_UPLOAD_BYTES * 1.1) {
    return c.json(
      { error: `Dosya çok büyük. Maks ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` },
      413
    );
  }

  const formData = await c.req.formData();
  const entry = formData.get("file");
  // Workers FormData: File yoksa null; string ise direkt değer döner.
  if (!entry || typeof entry === "string") {
    return c.json({ error: "file is required" }, 400);
  }
  const file = entry as File;

  if (file.size === 0) {
    return c.json({ error: "Boş dosya yüklenemez." }, 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return c.json(
      { error: `Dosya çok büyük. Maks ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` },
      413
    );
  }

  // MIME type kontrolü (sadece application/pdf kabul et).
  // Tarayıcılar bazen boş gönderir — uzantı fallback'i de uygula.
  const mime = file.type || "";
  const looksLikePdfName = /\.pdf$/i.test(file.name ?? "");
  if (mime && !ALLOWED_MIME.has(mime)) {
    return c.json({ error: "Sadece PDF dosyası yüklenebilir." }, 415);
  }
  if (!mime && !looksLikePdfName) {
    return c.json({ error: "Sadece PDF dosyası yüklenebilir." }, 415);
  }

  const safeName = sanitizeFilename(file.name ?? "file.pdf");
  const key = `kisisel/${safeName}`;

  // Stream body'yi doğrudan R2'ye geçir — tüm dosyayı RAM'e almıyoruz.
  await c.env.PDF_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: "application/pdf" },
  });

  return c.json({ success: true, key, size: file.size });
});
