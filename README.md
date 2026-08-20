# HMGS Hazırlık

Hukuk Mesleklerine Giriş Sınavı'na hazırlık PWA'sı. İki kullanıcılı, kişisel
kullanım için. **Sınav: 27 Eylül 2026** — 120 soru, 155 dakika, 20 alan,
geçme notu 70.

| | |
|---|---|
| Frontend | https://hukuk-efe.vercel.app |
| Worker | https://hukuk-worker.efearas06.workers.dev |

## Ne yapıyor

- **Deneme sınavı** — gerçek format (120 soru / 155 dk) ya da 20 soruluk kısa
  tur; resmî alan dağılımına göre soru seçiyor.
- **Soru bankası** — 3.467 soru, kanun metninden üretilip kaynağına karşı
  denetlenmiş. Kalitesi ve sınırları için `docs/DEVIR.md` §4.
- **Yanlışlarım** — yanlış cevaplananlar FSRS ile aralıklı tekrar kuyruğuna
  düşüyor.
- **Konu anlatımı** — 20 alan, 160 önceden üretilmiş konu anlatımı.
- **Çalışma planı** — alan ağırlığını ölçülen zayıflıkla çarpıp saat dağıtıyor.
- **AI asistan** — kanun metni üzerinde RAG + web araması, sayfa bağlamını
  biliyor.
- **Mevzuat / emsal karar araması** — canlı MCP sunucuları üzerinden.
- **Hata bildirimi** — kullanıcı hatalı soruyu bildiriyor, sahibi
  `/bildirimler` sayfasından sil/tut kararı veriyor.

## Yığın

Next.js 16 · Tailwind 4 · PWA (Vercel) — Cloudflare Worker (Hono) · D1 ·
Vectorize · R2 · Workers AI — DeepSeek (üretim + denetim) · Gemini
(çapraz doğrulama) · Tavily (web arama)

## Başlangıç

```bash
pnpm install
cp frontend/.env.example frontend/.env.local     # değerleri Efe'den al
cp worker/.dev.vars.example worker/.dev.vars
pnpm dev                                          # frontend :3000, worker :8787
```

```bash
pnpm test     # worker testleri (16 dosya)
pnpm build    # frontend build + worker typecheck
```

## Dağıtım

İkisi ayrı: `main` push'u frontend'i Vercel'e otomatik dağıtır; Worker şimdilik
elle dağıtılır.

```bash
pnpm --filter ./worker deploy     # Cloudflare
pnpm deploy:frontend              # Vercel için yalnız acil/elle geri dönüş
```

## Yapı

```
uygulama/
├── frontend/   Next.js PWA — sayfalar app/, ortak bileşenler components/
├── worker/     API ve iş mantığı — uçlar src/routes/, mantık src/lib/,
│               şema src/db/migrations/
├── scripts/    PDF yükleme ve gömme araçları (tek seferlik)
├── data/       Üretilmiş içerik (59 MB)
└── docs/       DEVIR.md · DEPLOY.md · DEVELOPMENT.md
```

## Nereden okumaya başlanır

1. **`AGENTS.md`** — çalışma kuralları ve dokunulmaması gerekenler.
2. **`docs/DEVIR.md`** — mimari, verinin hâli, verilmiş kararlar ve gerekçeleri,
   bilinen eksikler.
3. **`worker/src/routes/hmgs.ts`** — dosya başındaki yorum soru akışının
   tamamını anlatıyor.
