/**
 * validateQuestion — `npx tsx src/lib/hmgs-generator.test.ts`
 *
 * Bu kapı LLM ile veritabanı arasında duruyor: bozuk/anlamsız soru bankaya
 * girerse deneme çöpe döner ve elle temizlemek gerekir.
 */
import assert from "node:assert/strict";
import { validateQuestion } from "./hmgs-generator.js";

// Şık uzunlukları bilerek dengeli — uzunluk kapısı gerçek bir soruyu
// elemesin diye. (İlk hâlinde "Yazılı sözleşme" diğerlerinin 1.73 katıydı
// ve kapı testi haklı olarak reddetmişti.)
const ok = {
  question: "TBK m.49 uyarınca haksız fiil sorumluluğunun unsurları arasında hangisi yer almaz?",
  options: [
    "Fiilin hukuka aykırı olması",
    "Failin kusurlu bulunması",
    "Zararın meydana gelmesi",
    "Sözleşmenin yazılı yapılması",
  ],
  correctAnswer: 3,
  explanation: "TBK m.49'a göre unsurlar fiil, hukuka aykırılık, kusur, zarar ve illiyet bağıdır.",
  sourceIndex: 2,
};

assert.deepEqual(validateQuestion(ok), ok);

// sourceIndex yoksa/bozuksa null olur — çağıran bu soruları eler
assert.equal(validateQuestion({ ...ok, sourceIndex: 0 })?.sourceIndex, null);
assert.equal(validateQuestion({ ...ok, sourceIndex: "iki" })?.sourceIndex, null);
const { sourceIndex: _noIdx, ...withoutIdx } = ok;
assert.equal(validateQuestion(withoutIdx)?.sourceIndex, null);

// 4 şık şart
assert.equal(validateQuestion({ ...ok, options: ["a", "b", "c"] }), null);
assert.equal(validateQuestion({ ...ok, options: [...ok.options, "e"] }), null);

// aynı şık iki kez → çeldirici bozuk
assert.equal(
  validateQuestion({ ...ok, options: ["Kusur", "Kusur", "Zarar", "Fiil"] }),
  null
);

// boş şık
assert.equal(validateQuestion({ ...ok, options: ["a", "", "c", "d"] }), null);

// correctAnswer aralık dışı / tip hatası
assert.equal(validateQuestion({ ...ok, correctAnswer: 4 }), null);
assert.equal(validateQuestion({ ...ok, correctAnswer: -1 }), null);
assert.equal(validateQuestion({ ...ok, correctAnswer: 1.5 }), null);

// LLM şıkkı string yazarsa sayıya çevrilir — biçim farkı için geçerli soru atılmaz
assert.equal(
  validateQuestion({ ...ok, correctAnswer: "2" as unknown as number })?.correctAnswer,
  2
);
// ama sayıya çevrilemiyorsa reddedilir
assert.equal(validateQuestion({ ...ok, correctAnswer: "B" as unknown as number }), null);
assert.equal(validateQuestion({ ...ok, correctAnswer: null as unknown as number }), null);
assert.equal(validateQuestion({ ...ok, correctAnswer: "" as unknown as number }), null);
// alan hiç yoksa da reddedilmeli
const { correctAnswer: _drop, ...noAnswer } = ok;
assert.equal(validateQuestion(noAnswer), null);

// çok kısa soru / açıklama
assert.equal(validateQuestion({ ...ok, question: "Kısa?" }), null);
assert.equal(validateQuestion({ ...ok, explanation: "yok" }), null);

// çöp girdi
assert.equal(validateQuestion(null), null);
assert.equal(validateQuestion("soru"), null);
assert.equal(validateQuestion({}), null);

// correctAnswer 0 geçerli olmalı (falsy tuzağı)
assert.ok(validateQuestion({ ...ok, correctAnswer: 0 }));

// UZUNLUK KAPISI: doğru şık diğerlerinden belirgin uzunsa soru okunmadan
// bilinebiliyor. Bankada bu oran %47'ydi (şans %25).
assert.equal(
  validateQuestion({
    ...ok,
    options: ["Evet", "Hayır", "Belki", "Ancak kanunda açıkça öngörülen hâllerde ve hâkim kararıyla mümkündür"],
    correctAnswer: 3,
  }),
  null,
  "doğru şık aşırı uzunsa reddedilmeli"
);

// dengeli şıklar geçmeli — kapı fazla sıkı olmamalı
assert.ok(
  validateQuestion({
    ...ok,
    options: [
      "Kararın kesinleşme tarihinden itibaren",
      "Davanın açıldığı tarihten itibaren",
      "Tarafların ayrılık kararından itibaren",
      "Mahkemenin karar tarihinden itibaren",
    ],
    correctAnswer: 1,
  }),
  "dengeli şıklar geçmeli"
);

// UZUN olan YANLIŞ şıksa sorun yok — kapı yalnızca doğru şıkka bakar
assert.ok(
  validateQuestion({
    ...ok,
    options: ["Kısa doğru cevap", "Bu şık çok daha uzun yazılmış ve ayrıntılı açıklama içermektedir", "Diğer şık", "Başka şık"],
    correctAnswer: 0,
  }),
  "uzun olan yanlış şıksa reddedilmemeli"
);

console.log("validateQuestion: tüm kontroller geçti");
