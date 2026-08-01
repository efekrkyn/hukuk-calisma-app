/**
 * PDF metninde regex arama — hangi sayfada ne geçiyor.
 *   npx tsx grep-pdf.ts <pattern> <path> [...]
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { PDFParse } from "pdf-parse";

const [pattern, ...paths] = process.argv.slice(2);
const re = new RegExp(pattern, "i");

for (const path of paths) {
  const parser = new PDFParse({ data: readFileSync(path) });
  const res = await parser.getText();
  for (const [i, pg] of (res.pages ?? []).entries()) {
    const text = (pg.text ?? "").replace(/\s+/g, " ");
    if (re.test(text)) {
      const m = re.exec(text)!;
      const from = Math.max(0, m.index - 120);
      console.log(`\n${basename(path)} s.${i + 1}: …${text.slice(from, from + 420)}…`);
    }
  }
  await parser.destroy();
}
