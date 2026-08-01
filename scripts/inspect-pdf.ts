/**
 * PDF kimlik kontrolü — ingest öncesi "bu dosya gerçekten hangi kanun?" sorusu için.
 *   npx tsx inspect-pdf.ts <path> [<path>...]
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { PDFParse } from "pdf-parse";

async function main() {
  for (const path of process.argv.slice(2)) {
    const parser = new PDFParse({ data: readFileSync(path) });
    const res = await parser.getText();
    const pages = res.pages ?? [];
    const head = (pages[0]?.text ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
    console.log(`\n── ${basename(path)}  (${pages.length} sayfa)`);
    console.log(`   ${head || "(metin yok — taranmış olabilir)"}`);
    await parser.destroy();
  }
}
main();
