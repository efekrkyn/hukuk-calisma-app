/** `npx tsx src/lib/law-refs.test.ts` */
import assert from "node:assert/strict";
import { extractLawRefs } from "./law-refs.js";

const has = (t: string, no: string, madde?: string | null) => {
  const r = extractLawRefs(t).find((x) => x.mevzuatNo === no);
  assert.ok(r, `${no} bulunamadı: ${t.slice(0, 60)}`);
  if (madde !== undefined) assert.equal(r!.madde, madde, `${no} madde`);
};

// denetimde GERÇEKTEN çıkan gerekçeler
has("Soru Avukatlık Kanunu m.58'e dayanmakta olup verilen metinlerde yok", "1136", "58");
has("Soru FSEK m.75'e dayanmaktadır", "5846", "75");
has("5510 sayılı Kanun'un 80. maddesinin (b) bendi", "5510", "80");
has("TBK m.49 uyarınca haksız fiil sorumluluğu", "6098", "49");
has("CMK m.251/2 açıkça hüküm içermektedir", "5271", "251");
has("İYUK m.34/1'e göre yetkili mahkeme", "2577", "34");
has("TMK m. 219/1'e göre edinilmiş mal", "4721", "219");
has("AATUHK m. 102 «Tahsil Zamanaşımı»", "6183", "102");
// Türkçe büyük İ ile başlayan kısaltmalar: JS'te \\b bunları kaçırıyordu
has("İYUK m.34/1'e göre yetkili mahkeme", "2577", "34");
has("İİK m.89 uyarınca haciz ihbarnamesi", "2004", "89");

// kanun adıyla, madde numarası olmadan
has("4857 sayılı Kanun kapsamında", "4857", null);

// aynı metinde birden fazla kanun
const multi = extractLawRefs("TBK m.49 ile TMK m.24 birlikte değerlendirilir");
assert.equal(multi.length, 2);
assert.deepEqual(
  multi.map((r) => r.mevzuatNo).sort(),
  ["4721", "6098"]
);

// aynı kanun iki kez geçerse tek kayıt, madde bilgisi olan kazanır
const dup = extractLawRefs("6098 sayılı Kanun genel olarak; ayrıca TBK m.112 uyarınca");
assert.equal(dup.filter((r) => r.mevzuatNo === "6098").length, 1);
assert.equal(dup.find((r) => r.mevzuatNo === "6098")!.madde, "112");

// YANLIŞ POZİTİF OLMAMALI: rastgele sayı kanun sanılmamalı
assert.deepEqual(extractLawRefs("Tazminat 15000 TL olarak belirlendi"), []);
assert.deepEqual(extractLawRefs("İki yıl ve on yıl zamanaşımı süresi"), []);
assert.deepEqual(extractLawRefs(""), []);
assert.deepEqual(extractLawRefs("Bu soruda kanun referansı yok"), []);

console.log(`extractLawRefs: tüm kontroller geçti`);
