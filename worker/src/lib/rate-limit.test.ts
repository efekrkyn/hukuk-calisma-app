/** `npx tsx src/lib/rate-limit.test.ts` */
import assert from "node:assert/strict";
import { checkRate, rateBody, type RateBucket } from "./rate-limit.js";

// D1 yerine bellek içi taklit: tek satırlık bir tablo yetiyor.
function sahteDb() {
  const t = new Map<string, { window_start: number; count: number }>();
  return {
    prepare(sql: string) {
      let bag: unknown[] = [];
      const api = {
        bind(...a: unknown[]) {
          bag = a;
          return api;
        },
        async first() {
          // KOPYA döndür: gerçek D1 anlık kopya verir. Canlı referans
          // döndürmek run()'ın mutasyonunu çağırana sızdırıyor ve testi
          // gerçekte olmayan bir davranışa göre yazdırıyor.
          const r = t.get(String(bag[0]));
          return r ? { ...r } : null;
        },
        async run() {
          if (sql.includes("INSERT")) {
            t.set(String(bag[0]), { window_start: Number(bag[1]), count: 1 });
          } else {
            const r = t.get(String(bag[0]));
            if (r) r.count += 1;
          }
          return { meta: { changes: 1 } };
        },
      };
      return api;
    },
  } as unknown as D1Database;
}

const kova: RateBucket = { name: "test", limit: 3, windowMs: 1000 };

(async () => {
  const db = sahteDb();

  // Sınıra kadar geçmeli, kalan hak azalmalı.
  const r1 = await checkRate(db, "u1", kova, 1000);
  assert.equal(r1.ok, true);
  assert.equal(r1.remaining, 2);
  assert.equal((await checkRate(db, "u1", kova, 1000)).remaining, 1);
  assert.equal((await checkRate(db, "u1", kova, 1000)).remaining, 0);

  // Dördüncü çağrı reddedilmeli.
  const r4 = await checkRate(db, "u1", kova, 1000);
  assert.equal(r4.ok, false, "sınır aşıldığında reddetmeli");
  assert.equal(r4.remaining, 0);

  // Pencere dolunca sıfırlanmalı — asıl mesele bu, yoksa sınır kalıcı olur.
  const r5 = await checkRate(db, "u1", kova, 1000 + kova.windowMs);
  assert.equal(r5.ok, true, "pencere dolunca yeniden açılmalı");
  assert.equal(r5.remaining, 2);

  // Kullanıcılar birbirini etkilememeli.
  const b = await checkRate(db, "u2", kova, 1000);
  assert.equal(b.remaining, 2, "her kullanıcının bütçesi ayrı");

  // DB yoksa geçirmeli: sınırlama maliyet freni, güvenlik kapısı değil.
  const dbsiz = await checkRate(undefined, "u1", kova, 1000);
  assert.equal(dbsiz.ok, true);

  // 429 gövdesi ne zaman açılacağını söylemeli.
  const gövde = rateBody(kova, { ok: false, remaining: 0, resetAt: Date.now() + 120000 });
  assert.ok(gövde.error.includes("test"));
  assert.ok(gövde.detail.includes("dakika"));

  console.log("rate-limit: tüm kontroller geçti");
})();
