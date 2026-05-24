# Geliştirme

## Gereksinimler
- Node 22+ (test edildi: v24.15)
- pnpm 10+
- Cloudflare hesabı (D1 + R2 + Workers — hepsi free tier)

## Kurulum

```bash
git clone <repo>
cd uygulama
pnpm install
```

`scripts/.env` yarat (örnek):
```bash
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<...>
R2_SECRET_ACCESS_KEY=<...>
R2_BUCKET=hukuk-pdf
SOURCE_DIR=/Users/efekarakoyun/hukukçalışma/resources/dersler
OPENAI_API_KEY=<...>      # Sprint 1'de embeddings için
```

`frontend/.env.local`:
```bash
NEXT_PUBLIC_WORKER_URL=https://hukuk-worker.efearas06.workers.dev   # veya http://localhost:8787
```

## Çalıştırma

### Her ikisini paralel
```bash
pnpm dev
```

### Sadece frontend
```bash
pnpm dev:frontend
# → http://localhost:3000
```

### Sadece worker
```bash
pnpm dev:worker
# → http://localhost:8787 (Miniflare local R2 mock — boş)
```

> Local worker R2'yi boş görür çünkü Miniflare lokal mock kullanır. Production R2 için `NEXT_PUBLIC_WORKER_URL=https://hukuk-worker.efearas06.workers.dev` ile çalış.

## D1 Operasyonları

### Migration (schema değiştiğinde)
```bash
cd worker
npx wrangler d1 execute hukuk-db --local --file=db/schema.sql
npx wrangler d1 execute hukuk-db --remote --file=db/schema.sql
```

### Tabloları gör
```bash
npx wrangler d1 execute hukuk-db --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
```

### Query
```bash
npx wrangler d1 execute hukuk-db --remote --command "SELECT COUNT(*) FROM quiz_attempts;"
```

## R2 Operasyonları

### Tüm PDF'leri yükle (idempotent — atlanır)
```bash
cd scripts
pnpm upload-pdfs
```

### Bucket içeriği listele
```bash
pnpm list-pdfs
```

### Embedding üret (Sprint 1)
```bash
# OPENAI_API_KEY gerek
pnpm embed-pdfs                # tüm dersler
pnpm embed-pdfs borclar_ozel   # sadece bir ders
```

## Worker Deploy

```bash
pnpm --filter ./worker deploy
# → https://hukuk-worker.efearas06.workers.dev
```

## Test
Vitest setup Sprint 1'e ertelendi (vitest-pool-workers 0.16 D1 binding placeholder ile çakışıyor).

## Faydalı Komutlar

```bash
# Worker logları (canlı)
cd worker && npx wrangler tail

# D1 console
cd worker && npx wrangler d1 execute hukuk-db --remote

# Bundle boyutu
cd worker && npx wrangler deploy --dry-run
```
