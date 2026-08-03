/**
 * Metni çıkarılamayan PDF'leri bulur, her birinin ilk sayfalarını OCR'layıp
 * önizleme raporu yazar.
 *
 * Neden önizleme: macOS Vision basılı taramada mükemmel, Türkçe EL YAZISINDA
 * çöp üretiyor — ve güven skoru ikisini ayırmıyor (çöpte 0.95, temizde 0.96).
 * Otomatik kalite kapısı kurulamadığı için karar insana bırakılıyor: rapora
 * bak, işe yarayanları seç.
 *
 *   npx tsx ocr-preview.ts [kaynak-dizin]
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { PDFParse } from "pdf-parse";

const SOURCE_DIR =
  process.argv[2] ?? "/Users/efekarakoyun/hukukçalışma/resources/dersler";
const OUT = process.env.OCR_REPORT ?? "/tmp/ocr-preview.md";
const PREVIEW_PAGES = 2;

function* walkPdfs(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walkPdfs(full);
    else if (entry.toLowerCase().endsWith(".pdf")) yield full;
  }
}

/** pdf-parse metin çıkarabiliyor mu — çıkarabiliyorsa OCR'a gerek yok. */
async function hasText(path: string): Promise<boolean> {
  try {
    const parser = new PDFParse({ data: readFileSync(path) });
    const res = await parser.getText();
    const total = (res.pages ?? []).reduce((a, p) => a + (p.text ?? "").trim().length, 0);
    await parser.destroy();
    return total > 200;
  } catch {
    return false;
  }
}

const files = Array.from(walkPdfs(SOURCE_DIR));
console.log(`${files.length} PDF taranıyor…\n`);

const lines: string[] = [
  "# OCR önizleme",
  "",
  "Metni çıkarılamayan PDF'ler ve macOS Vision'ın ilk sayfalardan okuduğu metin.",
  "Okunabilir olanları seç; el yazısı olanlar anlamsız çıkacak ve index'e",
  "sokulursa aramayı bozar.",
  "",
];

let scanned = 0;
for (const f of files) {
  if (await hasText(f)) continue;
  scanned++;
  const rel = relative(SOURCE_DIR, f);
  process.stdout.write(`OCR: ${rel}\n`);
  let preview = "(OCR başarısız)";
  try {
    const out = execFileSync(
      "swift",
      [join(import.meta.dirname, "ocr-pdf.swift"), f, "200", String(PREVIEW_PAGES)],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }
    );
    const pages = JSON.parse(out) as Array<{ text: string }>;
    preview = pages.map((p) => p.text).join("\n").slice(0, 600).trim() || "(metin çıkmadı)";
  } catch (e) {
    preview = `(hata: ${String(e).slice(0, 120)})`;
  }
  lines.push(`## ${rel}`, "", "```", preview, "```", "");
}

lines.splice(6, 0, `Toplam ${files.length} PDF, metni çıkarılamayan: **${scanned}**`, "");
writeFileSync(OUT, lines.join("\n"));
console.log(`\nmetni çıkarılamayan: ${scanned}/${files.length}`);
console.log(`rapor: ${OUT}`);
