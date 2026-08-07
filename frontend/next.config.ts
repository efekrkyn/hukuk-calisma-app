import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

/**
 * Çevrimdışı çalışma.
 *
 * Varsayılan next-pwa yapılandırması tüm /api/ isteklerini tek bir
 * NetworkFirst kovasına, maxEntries: 16 ile koyuyordu. 160 konu anlatımı
 * ve deneme soruları aynı 16 gözü paylaşıyor, birbirini sürekli siliyordu:
 * çevrimdışı kalınca elde neredeyse hiçbir şey olmuyordu.
 *
 * Ayrım şu gerçeğe dayanıyor: konu anlatımı DEĞİŞMEZ (kanun metninden bir
 * kez üretilip veritabanında saklanıyor), deneme/performans verisi DEĞİŞİR.
 * Değişmeyeni uzun süre ve bol sayıda tut, değişeni ağdan iste.
 */
const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  workboxOptions: {
    skipWaiting: true,
    runtimeCaching: [
      {
        // Konu anlatımı — çevrimdışı çalışmanın asıl gövdesi.
        // POST olduğu için Workbox varsayılan olarak önbelleklemez; uçun
        // GET karşılığı yok, o yüzden istemci tarafında localStorage'a da
        // yazılıyor (ayrıntı: lib/topic-cache.ts). Buradaki kural sayfanın
        // kendisini ve kabuğunu çevrimdışı açılabilir tutuyor.
        urlPattern: /\/konular/,
        handler: "NetworkFirst",
        options: {
          cacheName: "konular-sayfa",
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      {
        // Diğer API'ler: taze veri önemli, ağ yoksa son bilinen hâl.
        // 16 değil 64 göz — deneme, performans, plan, tekrar hepsi burada.
        urlPattern: ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) =>
          sameOrigin && url.pathname.startsWith("/api/"),
        handler: "NetworkFirst",
        options: {
          cacheName: "api",
          networkTimeoutSeconds: 10,
          expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 7 },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {};

export default withPWA(nextConfig);
