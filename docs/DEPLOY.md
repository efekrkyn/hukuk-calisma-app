# Dağıtım

Son güncelleme: 8 Ağustos 2026.

## Canlı durum

| Servis | Adres | Durum |
|---|---|---|
| Frontend | https://hukuk-efe.vercel.app | Canlı (Vercel projesi: `hukuk-efe`) |
| Worker | https://hukuk-worker.efearas06.workers.dev | Canlı |
| D1 | `hukuk-db` (`9c7cb485-…`) | 25 tablo, ~176 MB |
| R2 | `hukuk-pdf` | Kaynak PDF'ler |
| Vectorize | `hukuk-vectors` | 45.429 parça |

## Her güncellemede

Frontend ve worker **ayrı** dağıtılır ve `git push` hiçbirini tetiklemez.
En sık yapılan hata worker'ı unutmak: arayüz yeni uçları çağırır, 404 alır.

```bash
# Worker
pnpm --filter ./worker deploy

# Frontend
pnpm deploy:frontend
```

Dağıtım sonrası doğrulama:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://hukuk-worker.efearas06.workers.dev/health
curl -s -o /dev/null -w "%{http_code}\n" https://hukuk-efe.vercel.app/login
```

`/health` 200, `/login` 200 dönmeli. Korumalı bir uç (`/hmgs/reports`) 401
dönmeli — 200 dönüyorsa kimlik doğrulama devre dışı kalmış demektir.

Vercel dağıtımının bittiğini görmek için:

```bash
cd frontend && npx vercel ls
```

En üstteki satır `● Ready` ve `Production` olmalı.

## Sırlar

Adlar ve ne işe yaradıkları `docs/DEVIR.md` §6'da. Değer yazma:

```bash
cd worker
npx wrangler secret put ADMIN_SECRET        # openssl rand -hex 32
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put GEMINI_KEY
npx wrangler secret put TAVILY_API_KEY
npx wrangler secret list                    # neyin tanımlı olduğunu gösterir
```

`ADMIN_SECRET` **hem worker'da hem Vercel'de** aynı olmak zorunda (frontend'in
`proxy.ts`'i JWT'yi onunla doğruluyor). Yalnızca birini değiştirirsen herkes
giriş yapar ama her istek 401 döner. Değiştirirsen dağıtılmış tüm oturumlar
da düşer.

Frontend değişkenleri: Vercel → `hukuk-efe` → Settings → Environment Variables.

## Veritabanı

Şema değişikliği `worker/db/migrations/NNN-ad.sql` olarak dosyaya yazılır,
sonra uygulanır:

```bash
cd worker
npx wrangler d1 execute hukuk-db --remote --file=db/migrations/013-yeni.sql
```

Yedek (**şu an düzenli yedek yok, tek nüsha**):

```bash
npx wrangler d1 export hukuk-db --remote --output=backup-$(date +%Y%m%d).sql
```

Geri yükleme aynı komutun `execute --file` hâli.

Silme/güncelleme çalıştırmadan önce aynı `WHERE` ile `SELECT COUNT(*)` çek.

## İlk kurulum (yapıldı, referans)

1. Cloudflare hesabı, R2 bucket `hukuk-pdf`
2. `cd worker && npx wrangler login`
3. `npx wrangler d1 create hukuk-db` → `database_id`'yi `wrangler.toml`'a yaz
4. `npx wrangler d1 execute hukuk-db --remote --file=db/schema.sql`,
   sonra `db/migrations/` içindekiler sırayla
5. `npx wrangler vectorize create hukuk-vectors --dimensions=1024 --metric=cosine`
6. R2 API token (Object Read & Write, `hukuk-pdf` kapsamı) → `scripts/.env`
7. `cd scripts && pnpm upload-pdfs`, sonra `pnpm embed-pdfs`
8. `cd worker && pnpm deploy`
9. `cd frontend && npx vercel` (proje adı `hukuk-efe`), sonra `npx vercel --prod`

## Maliyet

Hepsi ücretsiz kademede: Worker istekleri <100K/gün, R2 ~587 MB / 10 GB,
D1 ~176 MB / 5 GB. Ücretli olan tek şey LLM çağrıları (DeepSeek). Soru üretimi
durduğu için asıl gider kalemi de kapandı; geriye asistan ve konu anlatımı
kaldı — ikisi de hız sınırlı (`docs/DEVIR.md` §5).

Takip: Cloudflare → Workers & Pages → Analytics.
