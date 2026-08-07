/** `npx tsx src/lib/hmgs-verify-article.test.ts` */
import assert from "node:assert/strict";
import { hasArticle } from "./hmgs-verify.js";

// maddeyi metinde bulmalı
assert.equal(hasArticle("Kanunun bağlayıcılığı Madde 6- (1) Tanımlar...", "6"), true);
assert.equal(hasArticle("TCK m.265'e göre direnme suçu", "265"), true);
assert.equal(hasArticle("MADDE 384- Çekişmesiz yargıda yetki", "384"), true);

// ASIL KRİTİK DURUM: bu ayrım tutmazsa madde-düzeyi düzeltmenin tamamı boşa
// gider — "Madde 60" görülüp "Madde 6 zaten var" denir ve eksik madde
// çekilmez.
assert.equal(hasArticle("Madde 60- Tanıklıktan çekinme", "6"), false);
assert.equal(hasArticle("m.265/2 yargı görevi yapan", "26"), false);
assert.equal(hasArticle("Madde 1229- Konişmento", "122"), false);

// fıkralı atıfta madde numarası yakalanmalı
assert.equal(hasArticle("Madde 195/1-a-1 hâkimiyet", "195"), true);

// Madde bilgisi olmayan atıf doğrulanamaz; "yok" deyip her seferinde dışarı
// çıkmak gereksiz ağ çağrısı üretirdi.
assert.equal(hasArticle("herhangi bir metin", null), true);

// boş metinde bulunmamalı
assert.equal(hasArticle("", "6"), false);

console.log("hasArticle: tüm kontroller geçti");
