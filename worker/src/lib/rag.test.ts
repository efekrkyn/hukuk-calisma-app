/**
 * normalizePdfKey davranış kontrolü — `npx tsx src/lib/rag.test.ts`
 *
 * Kritik olan idempotanslık: eski index kayıtları prefix'siz ("kanunlar/x.pdf"),
 * yeni ingest'ler prefix'li ("dersler/kanunlar/x.pdf") geliyor. İkisi de aynı
 * ve doğru R2 key'ine çözülmeli, aksi halde reader linkleri 404 döner.
 */
import assert from "node:assert/strict";

// rag.ts Cloudflare tiplerine bağlı olduğu için fonksiyonu birebir kopyalıyoruz.
function normalizePdfKey(pdf: string): string {
  if (!pdf || pdf.startsWith("dersler/")) return pdf;
  return `dersler/${pdf}`;
}

// eski kayıtlar: prefix eklenir
assert.equal(normalizePdfKey("kanunlar/vergi-usul-213.pdf"), "dersler/kanunlar/vergi-usul-213.pdf");
assert.equal(normalizePdfKey("borclar_genel/pratikler.pdf"), "dersler/borclar_genel/pratikler.pdf");

// yeni kayıtlar: dokunulmaz (idempotent — çift prefix olmamalı)
assert.equal(normalizePdfKey("dersler/kanunlar/vergi-usul-213.pdf"), "dersler/kanunlar/vergi-usul-213.pdf");
assert.equal(normalizePdfKey(normalizePdfKey("kanunlar/x.pdf")), "dersler/kanunlar/x.pdf");

// boş metadata patlamamalı
assert.equal(normalizePdfKey(""), "");

console.log("normalizePdfKey: 5 kontrol geçti");
