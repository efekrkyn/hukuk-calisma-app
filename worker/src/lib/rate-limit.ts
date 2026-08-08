/**
 * Kullanıcı başına hız sınırı — para harcayan uçlar için.
 *
 * Amaç adil paylaşım değil, KAÇAK TÜKETİMİ durdurmak. Uygulama iki kişilik;
 * gerçek risk hatalı bir döngünün faturayı şişirmesi. 2026-08-07 gecesi tam
 * bunu yaşadık: yeniden denetim turu kendini bitiremeyip ~40 dakika aynı
 * sorulara para harcadı.
 *
 * Sabit pencere kullanılıyor, kayan pencere değil: pencere sınırında iki
 * katına kadar patlama mümkün ama tek satır okuma/yazma yetiyor. Bu amaç
 * için kaba olması yeterli.
 */

export type RateBucket = {
  /** Kova adı — aynı maliyet sınıfındaki uçlar tek bütçeyi paylaşır. */
  name: string;
  /** Pencere başına izin verilen çağrı. */
  limit: number;
  /** Pencere uzunluğu (ms). */
  windowMs: number;
};

export const SAAT = 60 * 60 * 1000;

/**
 * Kovalar ve sınırlar.
 *
 * Sayılar tek tek gerekçeli:
 * - uretim: soru üretimi kapandı (banka tamamlandı), sınır düşük tutuldu.
 *   Elle bir iki parti çalıştırmaya yeter, kaçak döngüyü keser.
 * - denetim: parti başına 8 soru; 400 çağrı = saatte 3200 soru. Bakım
 *   turlarının hızını kesmiyor ama sonsuz döngüyü 400'de durduruyor.
 * - anlatim: 160 konu bir kez üretildi, sonrası önbellekten geliyor.
 * - asistan: sohbet. Saatte 120 mesaj hiçbir gerçek kullanımı engellemez.
 */
export const BUCKETS: Record<string, RateBucket> = {
  uretim: { name: "uretim", limit: 60, windowMs: SAAT },
  denetim: { name: "denetim", limit: 400, windowMs: SAAT },
  anlatim: { name: "anlatim", limit: 60, windowMs: SAAT },
  asistan: { name: "asistan", limit: 120, windowMs: SAAT },
};

export type RateResult = {
  ok: boolean;
  /** Pencerede kalan hak. */
  remaining: number;
  /** Pencerenin bittiği an (unix ms) — yanıtta kullanıcıya söylenir. */
  resetAt: number;
};

/**
 * Sayacı bir artırır ve sınırın aşılıp aşılmadığını döner.
 *
 * DB yoksa veya sorgu patlarsa GEÇİRİR (ok: true). Sınırlama bir güvenlik
 * kapısı değil, maliyet freni; sayaç bozuldu diye uygulamayı durdurmak
 * korumadan daha çok zarar verir.
 */
export async function checkRate(
  db: D1Database | undefined,
  userId: string,
  bucket: RateBucket,
  now = Date.now()
): Promise<RateResult> {
  const acik = { ok: true, remaining: bucket.limit, resetAt: now + bucket.windowMs };
  if (!db) return acik;

  const key = `${userId}:${bucket.name}`;
  try {
    const row = await db
      .prepare(`SELECT window_start, count FROM rate_limits WHERE key = ?`)
      .bind(key)
      .first<{ window_start: number; count: number }>();

    // Pencere yoksa ya da dolduysa sıfırdan başlat.
    if (!row || now - row.window_start >= bucket.windowMs) {
      await db
        .prepare(
          `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
           ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = 1`
        )
        .bind(key, now)
        .run();
      return { ok: true, remaining: bucket.limit - 1, resetAt: now + bucket.windowMs };
    }

    const resetAt = row.window_start + bucket.windowMs;
    // Sayaç UPDATE'ten ÖNCE kopyalanıyor: sonuç `row` nesnesinin güncellemeden
    // sonra da eski değeri taşımasına bağlı kalmasın. D1 anlık kopya döndürüyor
    // ama bu varsayıma yaslanmak gereksiz kırılganlık.
    const oncekiSayac = row.count;
    if (oncekiSayac >= bucket.limit) {
      return { ok: false, remaining: 0, resetAt };
    }

    await db
      .prepare(`UPDATE rate_limits SET count = count + 1 WHERE key = ?`)
      .bind(key)
      .run();
    return { ok: true, remaining: bucket.limit - oncekiSayac - 1, resetAt };
  } catch (e) {
    console.error("rate-limit:", e);
    return acik;
  }
}

/** 429 gövdesi — ne zaman açılacağını söylemek, sadece reddetmekten iyi. */
export function rateBody(bucket: RateBucket, r: RateResult) {
  const dk = Math.max(1, Math.ceil((r.resetAt - Date.now()) / 60000));
  return {
    error: `Saatlik sınıra takıldın (${bucket.name}: ${bucket.limit}/saat).`,
    detail: `${dk} dakika sonra yeniden denenebilir.`,
    reset_at: r.resetAt,
  };
}
