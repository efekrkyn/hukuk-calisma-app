import "dotenv/config";
import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import mime from "mime-types";

const ENDPOINT = process.env.R2_ENDPOINT!;
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID!;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const BUCKET = process.env.R2_BUCKET ?? "hukuk-pdf";
const SOURCE_DIR =
  process.env.SOURCE_DIR ?? "/Users/efekarakoyun/hukukçalışma/resources/dersler";

if (!ENDPOINT || !ACCESS_KEY || !SECRET_KEY) {
  console.error("Missing env: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY");
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: ENDPOINT,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
});

function* walkPdfs(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walkPdfs(full);
    else if (entry.toLowerCase().endsWith(".pdf")) yield full;
  }
}

async function alreadyUploaded(): Promise<Map<string, number>> {
  const seen = new Map<string, number>();
  let token: string | undefined;
  do {
    const r = await client.send(
      new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token })
    );
    r.Contents?.forEach((o) => {
      if (o.Key) seen.set(o.Key, o.Size ?? 0);
    });
    token = r.NextContinuationToken;
  } while (token);
  return seen;
}

async function main() {
  console.log(`Bucket: ${BUCKET}`);
  console.log(`Source: ${SOURCE_DIR}`);
  const existing = await alreadyUploaded();
  console.log(`Bucket'ta mevcut: ${existing.size} dosya\n`);

  const allFiles = Array.from(walkPdfs(SOURCE_DIR));
  console.log(`Lokal PDF: ${allFiles.length} dosya\n`);

  let uploaded = 0,
    skipped = 0,
    failed = 0,
    bytesUploaded = 0;
  const start = Date.now();

  for (const fullPath of allFiles) {
    const key = `dersler/${relative(SOURCE_DIR, fullPath)}`;
    const localSize = statSync(fullPath).size;

    // Skip if exists and same size
    if (existing.get(key) === localSize) {
      skipped++;
      continue;
    }

    const body = readFileSync(fullPath);
    const contentType = mime.lookup(fullPath) || "application/pdf";
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: body,
          ContentType: contentType,
        })
      );
      uploaded++;
      bytesUploaded += body.length;
      const mb = (body.length / 1e6).toFixed(1);
      console.log(`✓ ${key} (${mb} MB)`);
    } catch (e) {
      failed++;
      console.error(`✗ ${key}: ${e}`);
    }
  }

  const dur = ((Date.now() - start) / 1000).toFixed(1);
  console.log(
    `\n=== Özet ===\n` +
      `Yüklenen: ${uploaded} dosya (${(bytesUploaded / 1e6).toFixed(1)} MB)\n` +
      `Atlanan:  ${skipped} (zaten var)\n` +
      `Hata:     ${failed}\n` +
      `Süre:     ${dur}s`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
