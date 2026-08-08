/**
 * normalizePdfKey davranış kontrolü — `npx tsx src/lib/rag.test.ts`
 *
 * Kritik olan idempotanslık: eski index kayıtları prefix'siz ("kanunlar/x.pdf"),
 * yeni ingest'ler prefix'li ("dersler/kanunlar/x.pdf") geliyor. İkisi de aynı
 * ve doğru R2 key'ine çözülmeli, aksi halde reader linkleri 404 döner.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

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

// D1 tam export'u FTS5 sanal tablolarını desteklemediği için gölge içerik
// taşınır; yedeğin gerçekten aranabilir bir indeks kurduğunu burada kanıtlarız.
const kaynak = new DatabaseSync(":memory:");
kaynak.exec(`
  CREATE VIRTUAL TABLE fts_chunks USING fts5(
    id UNINDEXED,
    course UNINDEXED,
    pdf UNINDEXED,
    page_start UNINDEXED,
    page_end UNINDEXED,
    text,
    tokenize="unicode61"
  );
  INSERT INTO fts_chunks(id, course, pdf, page_start, page_end, text) VALUES
    ('bir', 'anayasa', 'anayasa.pdf', 1, 2, 'Temel haklar korunur.'),
    ('iki', 'medeni', 'medeni.pdf', 3, 4, 'Kişilik hakkı devredilemez.');
`);

const hedef = new DatabaseSync(":memory:");
hedef.exec("CREATE TABLE fts_chunks_content(id INTEGER PRIMARY KEY, c0, c1, c2, c3, c4, c5);");
const ekle = hedef.prepare(
  "INSERT INTO fts_chunks_content(id, c0, c1, c2, c3, c4, c5) VALUES (?, ?, ?, ?, ?, ?, ?)",
);

for (const satir of kaynak.prepare("SELECT id, c0, c1, c2, c3, c4, c5 FROM fts_chunks_content").all()) {
  ekle.run(satir.id, satir.c0, satir.c1, satir.c2, satir.c3, satir.c4, satir.c5);
}

hedef.exec(readFileSync(new URL("../../db/fts-restore.sql", import.meta.url), "utf8"));

assert.equal(hedef.prepare("SELECT COUNT(*) AS toplam FROM fts_chunks").get()?.toplam, 2);
assert.deepEqual(
  { ...hedef.prepare("SELECT * FROM fts_chunks WHERE fts_chunks MATCH 'kişilik'").get() },
  {
    id: "iki",
    course: "medeni",
    pdf: "medeni.pdf",
    page_start: 3,
    page_end: 4,
    text: "Kişilik hakkı devredilemez.",
  },
);
assert.equal(
  hedef.prepare("SELECT name FROM sqlite_master WHERE name = 'fts_chunks_content_yedek'").get(),
  undefined,
);

kaynak.close();
hedef.close();
console.log("FTS yedeği: geri yükleme ve arama kontrolü geçti");
