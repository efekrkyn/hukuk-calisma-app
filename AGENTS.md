# AGENTS.md

Bu depoda çalışan yapay zekâ ajanları için işletim notları. Uzun anlatım
`docs/DEVIR.md`'de; burada yalnızca çalışmaya başlamak ve bir şeyi kırmamak
için gerekenler var.

## Proje nedir

HMGS (Hukuk Mesleklerine Giriş Sınavı) hazırlık PWA'sı. İki kişilik: uygulamayı
yazan (`efe` → `default` kullanıcısı) ve sınava giren (`irem`). Sınav tarihi
**27 Eylül 2026**. Ticari bir ürün değil, satılmıyor.

Uygulama dili **Türkçe**. Kod yorumları da Türkçe ve "ne" değil **"neden"**
anlatıyor — bu üslubu koru, yorumları İngilizceye çevirme.

## Yapı

```
uygulama/
├── frontend/    Next.js 16 + Tailwind 4, Vercel'de (proje adı: hukuk-efe)
├── worker/      Cloudflare Worker (Hono) — tüm API ve iş mantığı burada
├── scripts/     PDF yükleme / gömme (embedding) araçları, tek seferlik
├── data/        Üretilmiş içerik — 59 MB, kısmen gitignored
└── docs/        DEVIR.md, DEPLOY.md, DEVELOPMENT.md
```

Depo kökü `uygulama/` dizinidir (git burada başlar, bir üstte değil).

## Komutlar

```bash
pnpm install                 # kökte, pnpm workspaces
pnpm dev                     # frontend :3000 + worker :8787 paralel
pnpm test                    # worker testleri (16 dosya)
pnpm build                   # frontend build + worker typecheck
```

Dağıtım — frontend ve worker birbirinden bağımsızdır:

```bash
pnpm --filter ./worker deploy     # Cloudflare; şimdilik elle
pnpm deploy:frontend              # Vercel için yalnız acil/elle geri dönüş yolu
```

Vercel Git entegrasyonu `main` push'larını production'a, diğer dal/PR
push'larını preview'a dağıtır. Worker hâlâ otomatik değildir. Frontend yeni bir
Worker davranışına bağlıysa geriye uyumlu Worker'ı merge'den önce elle dağıt;
aksi halde arayüz yeni uçları çağırırken 404 alır.

## Testler

`node:assert/strict` + `npx tsx`. **Vitest kurulu değil**, kurma. Yeni test
`worker/src/**/*.test.ts` olarak yazılır, `pnpm test` hepsini sırayla koşar.

Önemsiz olmayan mantık (dal, döngü, ayrıştırıcı, para/güvenlik yolu) tek bir
çalıştırılabilir kontrol bırakır. Tek satırlık şeylere test yazma.

## Sınırlar — bunlara dokunma

- **`DEFAULT_USER_ID = "default"`** (`worker/src/routes/auth.ts`) migration
  010'daki INSERT ile birebir aynı olmak zorunda. Değişirse eski deneme, plan
  ve tekrar kayıtlarının tamamı erişilemez olur.
- **`LEGACY_SUB = "efe"`** eşlemesi, kullanıcı tablosundan önce dağıtılmış
  1 yıllık tokenlar için duruyor. Kaldırma.
- **Kayıt (`/auth/register`) bilerek kapalı**: arkasında para harcayan uçlar
  var. Açık kayıt = herkesin uygulama sahibinin faturasıyla soru üretmesi.
- **Soru bankası paylaşılır, gerisi kullanıcıya özel.** `hmgs_questions`,
  `hmgs_verdicts`, `hmgs_topics`, `hmgs_reports` herkesindir; `hmgs_attempts`,
  `hmgs_review`, `study_plans` kullanıcı bazlıdır. Bildirim kuyruğunu
  kullanıcıya bölme — hatalı soru herkese sorulmaya devam eder.
- **Soru üretimi kapandı** (2026-08-08 kararı). `/hmgs/generate` duruyor ama
  yeni soru üretilmeyecek. Denetim ve çapraz doğrulama açık.

## Sırlar

Kodda hiçbir sır yok, olmamalı. Adları `*.env.example` dosyalarında; değerleri
Efe'de. Worker sırları `wrangler secret put <AD>`, frontend'inkiler Vercel
proje ayarlarında.

Hiçbir parolayı, API anahtarını veya oturum token'ını dosyaya yazma,
commit'leme ya da log'lama.

## Veri işlemleri

> **DURUM (21.08.2026): OTOMATİK YEDEK ÇALIŞIYOR.** İlk yeşil koşu
> 21.08.2026 08:01 UTC'de tamamlandı; üretilen arşiv bağımsız olarak
> indirilip açıldı ve içeriği doğrulandı (3.466 soru, 45.429 FTS parçası,
> `integrity_check = ok`, FTS araması çalışıyor).
>
> Önceki üç koşu `CLOUDFLARE_API_TOKEN` yüzünden başarısızdı (`7403`, sonra
> `10000`); token yenilenince düzeldi. Ders: token doğruluğunu uzunluğuna
> bakarak değil `user/tokens/verify` ucuyla teyit et.

D1 canlı veritabanı her gün 01:17 UTC'de `.github/workflows/d1-backup.yml`
ile özel `hukuk-d1-backups` R2 bucket'ına yedeklenir; 35 günlük yaşam
döngüsü eski kopyaları siler. D1 tam export'u FTS5 sanal tablosunu
desteklemediği için arşiv normal tabloları, `fts_chunks_content` gölge
içeriğini ve `worker/db/fts-restore.sql` dosyasını birlikte taşır. Dışa aktarım
sürerken D1 sorguları engellenir; elle yedek gerekiyorsa aynı workflow'u
Actions'tan tetikle.

`DELETE`/`UPDATE` çalıştırmadan önce aynı `WHERE` ile `SELECT COUNT(*)`
çek ve sayıyı gör. Şema değişikliği
`worker/db/migrations/NNN-ad.sql` olarak dosyaya yazılır, elle uygulanmaz.

```bash
cd worker && npx wrangler d1 execute hukuk-db --remote --command "SELECT ..."
```

## Üslup

- En kısa çalışan çözüm; gereksiz soyutlama, tek uygulaması olan arayüz,
  hiç değişmeyen değer için config yok.
- Silme, eklemeye tercih edilir.
- Kullanıcıya gösterilen her hata metni Türkçe ve anlamlı olmalı —
  `HTTP 429` değil, "Saatlik sınıra takıldın, 45 dakika sonra dene".
- Bir hata bulduğunda semptomu değil kök nedeni düzelt: düzeltmeden önce
  dokunacağın fonksiyonun tüm çağıranlarına bak.
