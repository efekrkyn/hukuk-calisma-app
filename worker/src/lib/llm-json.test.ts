/** `npx tsx src/lib/llm-json.test.ts` */
import assert from "node:assert/strict";
import { parseLlmJson, stripLlmJson } from "./llm-json.js";

// reasoner'ın think bloğu
assert.deepEqual(
  parseLlmJson('<think>düşünüyorum...</think>{"a":1}'),
  { a: 1 }
);

// code fence
assert.deepEqual(parseLlmJson('```json\n{"a":2}\n```'), { a: 2 });

// ikisi birden
assert.deepEqual(
  parseLlmJson('<think>x</think>\n```json\n{"a":3}\n```'),
  { a: 3 }
);

// düz JSON
assert.deepEqual(parseLlmJson('{"a":4}'), { a: 4 });

// think içinde </think> geçerse SON kapanış esas alınmalı
assert.deepEqual(
  parseLlmJson('<think>şunu yazsam: </think> hayır</think>{"a":5}'),
  { a: 5 }
);

// bozuk çıktı patlamamalı
assert.equal(parseLlmJson("bu JSON değil"), null);
assert.equal(parseLlmJson(""), null);

// strip parse etmeden ham metni verir
assert.equal(stripLlmJson("```json\n[]\n```"), "[]");

console.log("llm-json: 8 kontrol geçti");
