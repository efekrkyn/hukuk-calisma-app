/** `npx tsx src/lib/hmgs-generator.test.ts` */
import assert from "node:assert/strict";
import { stripSourceRefs } from "./hmgs-generator.js";

// Örnekler uydurma değil: bankadaki 87 sızıntılı açıklamadan çıkarıldı.

// parantezli sourceIndex
assert.equal(
  stripSourceRefs("TBK m.325'e göre borç devam eder. (sourceIndex: 6)"),
  "TBK m.325'e göre borç devam eder."
);

// köşeli parantezli hâli
assert.equal(
  stripSourceRefs("Fonksiyon gaspı sayılır. [sourceIndex: 37]"),
  "Fonksiyon gaspı sayılır."
);

// tek ve çoklu Kaynak atıfları
assert.equal(stripSourceRefs("Şu şekildedir. (Kaynak [9])"), "Şu şekildedir.");
assert.equal(stripSourceRefs("Şu şekildedir. (Kaynak [1] ve [2])"), "Şu şekildedir.");
assert.equal(stripSourceRefs("Şu şekildedir. (kaynak [2])."), "Şu şekildedir.");

// cümle hâlindeki atıf: askıda kalan virgül atılıp cümle noktayla kapanıyor
assert.equal(
  stripSourceRefs(
    "Doğru cevap 'Altı ay' olup, kaynak [9]'daki madde metnine dayanılarak hazırlanmıştır."
  ),
  "Doğru cevap 'Altı ay' olup."
);

// ANLATIMA DAHİL atıf silinmez, nötrleştirilir. Bankada 8 açıklama bu
// biçimdeydi ve önceki regex hepsini tamamen boşaltıyordu: atıf cümlenin
// öznesi, silinemez.
assert.equal(
  stripSourceRefs("Kaynak [76]'da belirtildiği üzere Hume, devletin doğuşunu açıklar."),
  "Kaynak metninde belirtildiği üzere Hume, devletin doğuşunu açıklar."
);
assert.equal(
  stripSourceRefs("Kaynak [64]'te Austin'in görüşü aktarılır."),
  "Kaynak metninde Austin'in görüşü aktarılır."
);

// atıf yoksa metin bozulmamalı
const temiz = "İİK m.40/1'e göre icra muameleleri olduğu yerde durur.";
assert.equal(stripSourceRefs(temiz), temiz);

// madde numaralarına ve köşeli olmayan sayılara dokunulmamalı
const madde = "TCK m.87/2 (a) bendine göre ceza iki kat artırılır; alt sınır 6 yıldır.";
assert.equal(stripSourceRefs(madde), madde);

console.log("stripSourceRefs: tüm kontroller geçti");
