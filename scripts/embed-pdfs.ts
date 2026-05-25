/**
 * PDF parse + worker'a ingest pipeline (Cloudflare Workers AI bge-m3):
 *
 *   1. Walk PDFs in resources/dersler/
 *   2. Parse text PER PAGE (pdf-parse v2 PDFParse class)
 *   3. Group + chunk pages (~2000 chars per chunk with overlap)
 *   4. POST chunks (batch 100) to worker /admin/embed
 *      → Worker calls AI.run('@cf/baai/bge-m3') + upserts to Vectorize
 *   5. JSONL'i lokale de yaz (debug/recovery için)
 *
 * Maliyet: Cloudflare Workers AI free tier (10K Neurons/gün) — bizim ~50K chunk
 *          birkaç güne yayılır; veya paid plan $5/ay'da bir saatte biter.
 *
 * Usage:
 *   cd scripts
 *   pnpm embed-pdfs                       # all courses
 *   pnpm embed-pdfs borclar_ozel          # one course only
 */
import "dotenv/config";
import {
  readFileSync,
  readdirSync,
  statSync,
  mkdirSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { join, basename, relative } from "node:path";
import { PDFParse } from "pdf-parse";
import { createHash } from "node:crypto";

function shortHash(s: string, len = 12): string {
  return createHash("sha256").update(s).digest("hex").slice(0, len);
}

const SOURCE_DIR =
  process.env.SOURCE_DIR ??
  "/Users/efekarakoyun/hukukçalışma/resources/dersler";
const OUT_DIR =
  process.env.EMBED_OUT_DIR ??
  "/Users/efekarakoyun/hukukçalışma/uygulama/data/embeddings";
const WORKER_URL =
  process.env.WORKER_URL ?? "https://hukuk-worker.efearas06.workers.dev";
const ADMIN_SECRET = process.env.ADMIN_SECRET!;

const CHUNK_CHARS = 2000;
const CHUNK_OVERLAP = 400;
const BATCH_SIZE = 32; // bge-m3 önerilen, worker iç AI batch ile eşleşir
const RETRY_DELAY_MS = 2000;
const MAX_RETRIES = 5;

if (!ADMIN_SECRET) {
  console.error(
    "Missing ADMIN_SECRET in env (scripts/.env). Bu worker secret'ı ile aynı olmalı."
  );
  process.exit(1);
}

const argCourse = process.argv[2];

mkdirSync(OUT_DIR, { recursive: true });

function* walkPdfs(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walkPdfs(full);
    else if (entry.toLowerCase().endsWith(".pdf")) yield full;
  }
}

function chunkPage(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) return [];
  if (cleaned.length <= CHUNK_CHARS) return [cleaned];
  const chunks: string[] = [];
  let i = 0;
  while (i < cleaned.length) {
    const end = Math.min(i + CHUNK_CHARS, cleaned.length);
    chunks.push(cleaned.slice(i, end));
    if (end === cleaned.length) break;
    i = end - CHUNK_OVERLAP;
  }
  return chunks;
}

function chunkPagesGrouped(
  pages: Array<{ pageNumber: number; text: string }>
): Array<{ page_start: number; page_end: number; text: string }> {
  const out: Array<{ page_start: number; page_end: number; text: string }> = [];
  let buf = "";
  let startPage = 0;
  let endPage = 0;

  const flush = () => {
    if (buf.trim().length === 0) return;
    const sub = chunkPage(buf);
    for (const s of sub)
      out.push({ page_start: startPage, page_end: endPage, text: s });
    buf = "";
  };

  for (const p of pages) {
    const text = p.text.replace(/\s+/g, " ").trim();
    if (text.length === 0) continue;

    if (buf.length === 0) {
      startPage = p.pageNumber;
      endPage = p.pageNumber;
      buf = text;
    } else if (buf.length + text.length + 1 < CHUNK_CHARS) {
      buf += "\n" + text;
      endPage = p.pageNumber;
    } else {
      flush();
      startPage = p.pageNumber;
      endPage = p.pageNumber;
      buf = text;
    }

    if (buf.length >= CHUNK_CHARS) {
      flush();
    }
  }
  flush();
  return out;
}

type Chunk = {
  id: string;
  course: string;
  pdf: string;
  page_start: number;
  page_end: number;
  text: string;
};

async function processPdf(fullPath: string): Promise<Chunk[]> {
  const rel = relative(SOURCE_DIR, fullPath);
  const course = rel.split("/")[0];
  const pdfName = basename(fullPath);
  const data = readFileSync(fullPath);

  const parser = new PDFParse({ data: new Uint8Array(data) });
  let textResult;
  try {
    textResult = await parser.getText();
  } catch (e) {
    await parser.destroy().catch(() => {});
    throw e;
  }
  await parser.destroy();

  // pdf-parse v2: PageTextResult { num, text }
  const pages = (textResult.pages ?? []).map((p: any) => ({
    pageNumber: (p.num ?? p.pageNumber) as number,
    text: (p.text as string) ?? "",
  }));

  if (pages.length === 0 || pages.every((p) => p.text.trim().length === 0)) {
    console.warn(`  [scanned, skip] ${pdfName}`);
    return [];
  }

  const grouped = chunkPagesGrouped(pages);
  // Vectorize ID limit: 64 byte. Hash kullanarak short, stable IDs.
  // Format: {course-short}_{pdf-hash}_{idx}  → ~30 bytes
  const pdfHash = shortHash(rel, 12);
  const courseShort = course.slice(0, 16);
  return grouped.map((g, idx) => ({
    id: `${courseShort}_${pdfHash}_${idx.toString().padStart(4, "0")}`,
    course,
    pdf: rel,
    page_start: g.page_start,
    page_end: g.page_end,
    text: g.text,
  }));
}

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function ingestBatch(chunks: Chunk[]): Promise<number> {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const r = await fetch(`${WORKER_URL}/admin/embed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ADMIN_SECRET}`,
        },
        body: JSON.stringify({ chunks }),
      });
      if (!r.ok) {
        const text = await r.text();
        // Rate limit / transient
        if ((r.status === 429 || r.status >= 500) && attempt < MAX_RETRIES) {
          const backoff = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          console.warn(
            `  [${r.status}] retry ${attempt}/${MAX_RETRIES} in ${backoff}ms`
          );
          await sleep(backoff);
          continue;
        }
        throw new Error(`worker /admin/embed ${r.status}: ${text.slice(0, 300)}`);
      }
      const data = (await r.json()) as { ok: boolean; count: number };
      return data.count;
    } catch (e) {
      if (attempt < MAX_RETRIES) {
        const backoff = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`  network error retry ${attempt}/${MAX_RETRIES}: ${e}`);
        await sleep(backoff);
        continue;
      }
      throw e;
    }
  }
}

async function main() {
  console.log(`Source:    ${SOURCE_DIR}`);
  console.log(`Worker:    ${WORKER_URL}`);
  console.log(`Out cache: ${OUT_DIR}`);
  console.log(`Filter:    ${argCourse ?? "(all courses)"}\n`);

  const allFiles = Array.from(walkPdfs(SOURCE_DIR));
  const filtered = argCourse
    ? allFiles.filter((f) =>
        relative(SOURCE_DIR, f).startsWith(argCourse + "/")
      )
    : allFiles;

  console.log(`Processing ${filtered.length} PDFs\n`);

  let totalChunks = 0;
  let totalIngested = 0;
  const byCourse: Record<string, Chunk[]> = {};

  for (const f of filtered) {
    const rel = relative(SOURCE_DIR, f);
    process.stdout.write(`▶ ${rel} ... `);
    try {
      const chunks = await processPdf(f);
      console.log(`${chunks.length} chunks`);
      const course = rel.split("/")[0];
      (byCourse[course] ??= []).push(...chunks);
      totalChunks += chunks.length;
    } catch (e) {
      console.log(`ERROR: ${e}`);
    }
  }

  console.log(`\n=== Sending ${totalChunks} chunks to worker (bge-m3) ===\n`);
  for (const [course, chunks] of Object.entries(byCourse)) {
    if (!chunks.length) continue;

    // Cache JSONL (no vectors — worker has them in Vectorize)
    const outFile = join(OUT_DIR, `${course}.jsonl`);
    writeFileSync(outFile, chunks.map((c) => JSON.stringify(c)).join("\n"));

    console.log(`▶ ${course}: ingesting ${chunks.length} chunks`);
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const count = await ingestBatch(batch);
      totalIngested += count;
      process.stdout.write(
        `  batch ${Math.ceil((i + BATCH_SIZE) / BATCH_SIZE)}/${Math.ceil(
          chunks.length / BATCH_SIZE
        )} (+${count})\r`
      );
    }
    console.log();
  }

  console.log(
    `\n=== Özet ===\n` +
      `Chunks: ${totalChunks}\n` +
      `Ingested to Vectorize: ${totalIngested}\n` +
      `JSONL cache: ${OUT_DIR}/`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
