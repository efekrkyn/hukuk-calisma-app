/** `npx tsx src/lib/shuffle-options.test.ts` */
import assert from "node:assert/strict";
import { shuffleOptions } from "./shuffle-options.js";

const q = {
  question: "x",
  options: ["A-metni", "B-metni", "C-metni", "D-metni"],
  correctAnswer: 1, // B-metni
};

// EN KRİTİK: karıştırma sonrası correctAnswer hâlâ aynı METNİ göstermeli
for (let seed = 0; seed < 200; seed++) {
  const s = shuffleOptions(q);
  assert.equal(s.options[s.correctAnswer], "B-metni", "doğru cevap metni kaydı");
  assert.equal(s.options.length, 4);
  assert.deepEqual([...s.options].sort(), [...q.options].sort(), "şıklar kaybolmamalı");
}

// girdi mutasyona uğramamalı
const before = JSON.stringify(q);
shuffleOptions(q);
assert.equal(JSON.stringify(q), before, "girdi değişmemeli");

// dağılım gerçekten yayılmalı — tek pozisyonda sıkışırsa amaç kaçar
const hits = [0, 0, 0, 0];
for (let i = 0; i < 4000; i++) hits[shuffleOptions(q).correctAnswer]++;
for (const [i, n] of hits.entries()) {
  assert.ok(n > 700, `pozisyon ${i} sadece ${n} kez çıktı, dağılım bozuk`);
}

// deterministik rand ile öngörülebilir olmalı (test edilebilirlik)
const fixed = shuffleOptions(q, () => 0);
assert.equal(fixed.options[fixed.correctAnswer], "B-metni");

console.log(`shuffleOptions: dağılım ${hits.join("/")} — kontroller geçti`);
