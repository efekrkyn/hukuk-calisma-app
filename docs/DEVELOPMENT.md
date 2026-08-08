# Geliştirme

Son güncelleme: 8 Ağustos 2026.

## Gereksinimler

- Node 22+ (test edildi: v24.15)
- pnpm 10+
- Cloudflare hesabı (D1 + R2 + Vectorize + Workers)
- Vercel hesabı (frontend)

## Kurulum

```bash
git clone https://github.com/efekrkyn/hukuk-calisma-app.git
cd hukuk-calisma-app/uygulama
pnpm install
cp frontend/.env.example frontend/.env.local
cp worker/.dev.vars.example worker/.dev.vars
# değerleri Efe'den al — açıklamaları docs/DEVIR.md §6'da
pnpm test        # 16/16 geçmeli, kurulumun doğru olduğunu bu doğrular
```

## Çalıştırma

```bash
pnpm dev            # ikisi paralel: :3000 ve :8787
pnpm dev:frontend   # yalnız frontend
pnpm dev:worker     # yalnız worker
```

**Yerel worker'ın verisi yoktur.** Miniflare yerel bir mock kullanıyor; R2 boş,
D1 boş görünür. Gerçek veriyle çalışmak için `frontend/.env.local` içinde
`NEXT_PUBLIC_WORKER_URL`'i boş bırak ya da canlı worker adresini yaz — o zaman
yerel arayüz canlı veriye bağlanır.

**Giriş gerekiyor.** `proxy.ts` `/login` dışındaki her yolu oturum çerezine
bağlıyor; oturum olmadan her sayfa `/login`'e 307 döner. Yerelde de gerçek
parolayla giriş yapman gerekir — kimlik doğrulamayı atlayan bir geliştirme
kapısı bilerek yok.

## Test

`node:assert/strict` + `npx tsx`. **Vitest kurulu değil** (vitest-pool-workers
D1 binding'iyle çakıştığı için hiç kurulmadı); kurmaya çalışma.

```bash
pnpm test                          # hepsi
npx tsx worker/src/lib/srs.test.ts # tek dosya
```

Yeni test `worker/src/**/*.test.ts` adıyla yazılır, betik onu kendiliğinden
bulur. Frontend'de test altyapısı yok.

## D1

```bash
cd worker
npx wrangler d1 execute hukuk-db --remote --command "SELECT COUNT(*) FROM hmgs_questions"
npx wrangler d1 execute hukuk-db --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
```

Uzun ya da tırnak içeren sorgular için `--command` yerine `--file` kullan;
kabuk tırnakları bozuyor.

Şema değişikliği **her zaman** `db/migrations/NNN-ad.sql` dosyası olarak
yazılır, sonra uygulanır. Elle `ALTER TABLE` çalıştırma — bir sonraki kişi
şemanın nereden geldiğini bulamaz.

Silmeden önce aynı `WHERE` ile `SELECT COUNT(*)` çek. Yedek yok.

## R2 ve gömme (embedding)

Tek seferlik işler; `scripts/.env` gerekiyor.

```bash
cd scripts
pnpm upload-pdfs                # idempotent, var olanı atlar
pnpm list-pdfs
pnpm embed-pdfs                 # tüm kaynaklar
pnpm embed-pdfs borclar_ozel    # tek ders
```

Gömme modeli `@cf/baai/bge-m3` (1024 boyut, cosine). Vectorize indeksi
yeniden kurulacaksa aynı boyutla yaratılmalı.

## Faydalı

```bash
cd worker && npx wrangler tail              # canlı worker logları
cd worker && npx wrangler deploy --dry-run  # bundle boyutu
cd worker && npx wrangler secret list       # hangi sırlar tanımlı
cd frontend && npx vercel ls                # dağıtım durumu
```

## Kod üslubu

Yorumlar Türkçe ve **"neden"** anlatıyor, "ne" değil. Kodun ne yaptığı zaten
kodda yazıyor; bir sonraki kişinin bilemeyeceği şey neden öyle yapıldığı.
Özellikle bir eşiği, bir sınırı ya da alışılmadık görünen bir kararı
değiştirecek olan kişi, gerekçesini orada bulmalı.

Kullanıcıya görünen her metin Türkçe. Hata mesajları da: `HTTP 429` değil,
"Saatlik sınıra takıldın, 45 dakika sonra dene".
