/**
 * Embedding pipeline:
 *   1. Walk all PDFs in resources/dersler/
 *   2. Extract text per page
 *   3. Chunk (~500 token windows with 100 token overlap)
 *   4. Embed via OpenAI text-embedding-3-small (1536-dim)
 *   5. Save as JSONL: { id, course, pdf, page_start, page_end, text, vector }
 *
 * One-time cost: ~590MB PDFs × ~600 tokens/page × $0.02/1M ≈ $0.50-$1.00
 *
 * Usage:
 *   cd scripts
 *   export $(cat .env | xargs)            # OPENAI_API_KEY set
 *   pnpm embed-pdfs                       # all courses
 *   pnpm embed-pdfs borclar_ozel          # one course only
 */
import "dotenv/config";
import OpenAI from "openai";
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, basename, relative } from "node:path";
// @ts-expect-error - pdf-parse types are loose
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const SOURCE_DIR =
  process.env.SOURCE_DIR ?? "/Users/efekarakoyun/hukukçalışma/resources/dersler";
const OUT_DIR =
  process.env.EMBED_OUT_DIR ?? "/Users/efekarakoyun/hukukçalışma/uygulama/data/embeddings";
const MODEL = process.env.EMBED_MODEL ?? "text-embedding-3-small";
const CHUNK_CHARS = 2000;      // ~500 tokens
const CHUNK_OVERLAP = 400;     // ~100 tokens
const BATCH_SIZE = 64;         // embeddings per API call

if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY in env");
  process.exit(1);
}

const client = new OpenAI();
const argCourse = process.argv[2]; // optional filter

mkdirSync(OUT_DIR, { recursive: true });

function* walkPdfs(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walkPdfs(full);
    else if (entry.toLowerCase().endsWith(".pdf")) yield full;
  }
}

function chunkText(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
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

type Chunk = {
  id: string;
  course: string;
  pdf: string;          // relative path under dersler/
  page_start: number;
  page_end: number;
  text: string;
  vector?: number[];    // 1536 dim float
};

async function embedBatch(texts: string[]): Promise<number[][]> {
  const r = await client.embeddings.create({ model: MODEL, input: texts });
  return r.data.map((d) => d.embedding);
}

async function processPdf(fullPath: string): Promise<Chunk[]> {
  const rel = relative(SOURCE_DIR, fullPath);
  const course = rel.split("/")[0];
  const pdfName = basename(fullPath);
  const data = readFileSync(fullPath);
  const parsed = await pdfParse(data);

  // pdf-parse returns full text, no per-page split easily.
  // For chunking, we approximate page positions by character ratios.
  const fullText = parsed.text;
  const totalPages = parsed.numpages;
  const chunks: Chunk[] = [];

  const rawChunks = chunkText(fullText);
  if (rawChunks.length === 0 || rawChunks[0] === "") {
    // Scanned PDF, no text — skip with warning
    console.warn(`  [scanned, skip] ${pdfName}`);
    return [];
  }

  rawChunks.forEach((text, idx) => {
    const charRatio = idx / Math.max(1, rawChunks.length);
    const pageStart = Math.max(1, Math.floor(charRatio * totalPages) + 1);
    const pageEnd = Math.min(totalPages, pageStart + Math.ceil(totalPages / rawChunks.length));
    chunks.push({
      id: `${course}/${pdfName.replace(/\.pdf$/i, "")}/${idx.toString().padStart(4, "0")}`,
      course,
      pdf: rel,
      page_start: pageStart,
      page_end: pageEnd,
      text,
    });
  });

  return chunks;
}

async function main() {
  console.log(`Source:  ${SOURCE_DIR}`);
  console.log(`Out:     ${OUT_DIR}`);
  console.log(`Model:   ${MODEL}`);
  console.log(`Filter:  ${argCourse ?? "(all courses)"}\n`);

  const allFiles = Array.from(walkPdfs(SOURCE_DIR));
  const filtered = argCourse
    ? allFiles.filter((f) => relative(SOURCE_DIR, f).startsWith(argCourse + "/"))
    : allFiles;

  console.log(`Processing ${filtered.length} PDFs\n`);

  let totalChunks = 0;
  let totalCost = 0;
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

  // Embed each course's chunks
  console.log(`\n=== Embedding ${totalChunks} chunks ===\n`);
  for (const [course, chunks] of Object.entries(byCourse)) {
    if (!chunks.length) continue;
    console.log(`▶ ${course}: embedding ${chunks.length} chunks`);
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const vectors = await embedBatch(batch.map((c) => c.text));
      batch.forEach((c, j) => (c.vector = vectors[j]));
      // Rough cost estimate (text-embedding-3-small = $0.02 / 1M tokens)
      const tokensApprox = batch.reduce((s, c) => s + c.text.length / 4, 0);
      totalCost += (tokensApprox / 1_000_000) * 0.02;
      process.stdout.write(`  batch ${Math.ceil((i + BATCH_SIZE) / BATCH_SIZE)}/${Math.ceil(chunks.length / BATCH_SIZE)}\r`);
    }
    console.log();

    // Write JSONL
    const outFile = join(OUT_DIR, `${course}.jsonl`);
    const jsonl = chunks.map((c) => JSON.stringify(c)).join("\n");
    writeFileSync(outFile, jsonl);
    console.log(`  ✓ ${outFile} (${(statSync(outFile).size / 1e6).toFixed(2)} MB)`);
  }

  console.log(
    `\n=== Özet ===\n` +
      `Chunks: ${totalChunks}\n` +
      `Tahmini maliyet: $${totalCost.toFixed(3)}\n` +
      `Çıktı:  ${OUT_DIR}/`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
