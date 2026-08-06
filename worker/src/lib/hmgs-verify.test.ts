/** `npx tsx src/lib/hmgs-verify.test.ts` */
import assert from "node:assert/strict";
import { normalizeVerdict } from "./hmgs-verify.js";

// gecerli kararlar
for (const v of ["correct", "wrong", "unsupported", "ambiguous"]) {
  const r = normalizeVerdict({ id: "q1", verdict: v, reason: "gerekçe" });
  assert.equal(r?.verdict, v);
}

// buyuk harf / bosluk toleransi — model bicimi kaydirabilir
assert.equal(normalizeVerdict({ id: "q1", verdict: " CORRECT " })?.verdict, "correct");

// TANIMSIZ karar KABUL EDILMEMELI: "belki"yi sessizce "correct" saymak
// denetimin amacini yok eder
assert.equal(normalizeVerdict({ id: "q1", verdict: "belki" }), null);
assert.equal(normalizeVerdict({ id: "q1", verdict: "ok" }), null);
assert.equal(normalizeVerdict({ id: "q1" }), null);

// id yoksa hangi soruya ait oldugu bilinemez
assert.equal(normalizeVerdict({ verdict: "correct" }), null);
assert.equal(normalizeVerdict({ id: "   ", verdict: "correct" }), null);

// cop girdi
assert.equal(normalizeVerdict(null), null);
assert.equal(normalizeVerdict("correct"), null);

// reason opsiyonel ve kirpiliyor
assert.equal(normalizeVerdict({ id: "q1", verdict: "wrong" })?.reason, "");
assert.equal(
  normalizeVerdict({ id: "q1", verdict: "wrong", reason: "x".repeat(900) })?.reason.length,
  500
);

console.log("normalizeVerdict: tüm kontroller geçti");
