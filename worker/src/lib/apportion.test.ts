/** `npx tsx src/lib/apportion.test.ts` */
import assert from "node:assert/strict";
import { apportion } from "./apportion.js";
import { HMGS_SUBJECTS } from "./hmgs-subjects.js";

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

// asıl mesele: toplam her zaman istenen sayıya eşit olmalı
const w = HMGS_SUBJECTS.map((s) => s.count);
for (const n of [10, 20, 40, 60, 120]) {
  assert.equal(sum(apportion(w, n)), n, `${n} soruluk deneme ${sum(apportion(w, n))} döndü`);
}

// tam bölünen hâlde oranlar birebir korunmalı
assert.deepEqual(apportion(w, 120), w);

// en ağır alan en çok soruyu almalı (Medeni %12,5)
const a20 = apportion(w, 20);
const heaviest = w.indexOf(Math.max(...w));
assert.equal(a20[heaviest], Math.max(...a20));

// basit paylaştırma
assert.deepEqual(apportion([1, 1, 1], 3), [1, 1, 1]);
assert.deepEqual(sum(apportion([1, 1, 1], 4)), 4);
assert.deepEqual(apportion([3, 1], 4), [3, 1]);

// sınır durumlar patlamamalı
assert.deepEqual(apportion([], 10), []);
assert.deepEqual(apportion([0, 0], 5), [0, 0]);
assert.deepEqual(apportion([1, 2], 0), [0, 0]);

// alan sayısından az soru istenirse yine toplam tutmalı
assert.equal(sum(apportion(w, 5)), 5);

console.log("apportion: tüm kontroller geçti");
