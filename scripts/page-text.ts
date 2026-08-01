/**
 * Tek sayfanın tam metni.
 *   npx tsx page-text.ts <path> <pageNo>
 */
import { readFileSync } from "node:fs";
import { PDFParse } from "pdf-parse";

const [path, pageNo] = process.argv.slice(2);
const parser = new PDFParse({ data: readFileSync(path) });
const res = await parser.getText();
const pg = (res.pages ?? [])[Number(pageNo) - 1];
console.log((pg?.text ?? "(sayfa yok)").replace(/[ \t]+/g, " "));
await parser.destroy();
