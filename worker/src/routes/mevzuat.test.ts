/** `npx tsx src/routes/mevzuat.test.ts` */
import assert from "node:assert/strict";
import { parseMevzuatLines } from "./mevzuat.js";

const sample = `Search: title='gelir vergisi' | Type: KANUN
Results: 13 total (page 1)

- [7420] GELİR VERGİSİ KANUNU İLE BAZI KANUNLARDA DEĞİŞİKLİK YAPILMASINA DAİR KANUN (Kanunlar) | mevzuatId: 103175 | RG: 2022-11-09 | gerekceId: 2686
- [6663] GELİR VERGİSİ KANUNU İLE BAZI KANUNLARDA DEĞİŞİKLİK YAPILMASINA DAİR KANUN  (Kanunlar) | mevzuatId: 104389 | RG: 2016-02-10
`;

const items = parseMevzuatLines(sample);
assert.equal(items.length, 2, "başlık/özet satırları sonuç sayılmamalı");

assert.equal(items[0].mevzuat_no, "7420");
assert.equal(items[0].mevzuat_id, "103175");
assert.equal(items[0].rg_tarihi, "2022-11-09");
assert.equal(items[0].tur, "Kanunlar");
assert.ok(items[0].title.startsWith("GELİR VERGİSİ KANUNU"));
assert.ok(!items[0].title.includes("mevzuatId"), "başlığa kuyruk sızmamalı");

// RG tarihi olmayan satır da alınmalı (alan opsiyonel)
const noRg = parseMevzuatLines("- [4721] TÜRK MEDENÎ KANUNU (Kanunlar) | mevzuatId: 100001");
assert.equal(noRg.length, 1);
assert.equal(noRg[0].rg_tarihi, null);
assert.equal(noRg[0].mevzuat_no, "4721");

// çöp girdi patlamamalı
assert.deepEqual(parseMevzuatLines(""), []);
assert.deepEqual(parseMevzuatLines("Search error: data.pageSize=..."), []);
assert.deepEqual(parseMevzuatLines("- bozuk satir"), []);

console.log(`parseMevzuatLines: ${items.length} kayıt ayrıştırıldı — kontroller geçti`);
