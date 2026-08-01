/**
 * HMGS dağılımı ÖSYM kılavuzuyla tutuyor mu — `npx tsx src/lib/hmgs-subjects.test.ts`
 *
 * Yüzdeler ve soru sayıları elle girildi; biri kayarsa deneme gerçek sınavı
 * temsil etmez. En ucuz kontrol: toplamlar.
 */
import assert from "node:assert/strict";
import { HMGS_SUBJECTS, HMGS_TOTAL_QUESTIONS, getSubject } from "./hmgs-subjects.js";

const pct = HMGS_SUBJECTS.reduce((a, s) => a + s.percent, 0);
assert.equal(Math.round(pct * 100) / 100, 100, `yüzdeler %100 olmalı, ${pct} çıktı`);

const total = HMGS_SUBJECTS.reduce((a, s) => a + s.count, 0);
assert.equal(total, HMGS_TOTAL_QUESTIONS, `soru sayısı 120 olmalı, ${total} çıktı`);

// her alanın sayısı kendi yüzdesiyle uyumlu olmalı
for (const s of HMGS_SUBJECTS) {
  const expected = Math.round((s.percent / 100) * HMGS_TOTAL_QUESTIONS);
  assert.equal(s.count, expected, `${s.name}: %${s.percent} → ${expected} bekleniyordu, ${s.count} var`);
}

// kılavuzdaki 20 alan
assert.equal(HMGS_SUBJECTS.length, 20);

// id'ler benzersiz
assert.equal(new Set(HMGS_SUBJECTS.map((s) => s.id)).size, 20, "id'ler benzersiz olmalı");

assert.ok(getSubject("medeni"));
assert.equal(getSubject("yok_boyle_bir_alan"), undefined);

// her alanda lawFiles tanımlı olmalı (boş olabilir ama eksik olamaz)
for (const s of HMGS_SUBJECTS) {
  assert.ok(Array.isArray(s.lawFiles), `${s.name}: lawFiles dizi olmalı`);
}

// alanların çoğu korpustan karşılanabilmeli; hepsi boşsa eşleştirme kopmuş demektir
const coverable = HMGS_SUBJECTS.filter((s) => s.lawFiles.length > 0);
assert.ok(coverable.length >= 15, `karşılanabilir alan ${coverable.length}, en az 15 bekleniyor`);

console.log(`karşılanabilir alan: ${coverable.length}/20`);

console.log(`HMGS dağılımı: %${pct} / ${total} soru / ${HMGS_SUBJECTS.length} alan — kontroller geçti`);
