# Deploy

## Mevcut Production Durumu

| Servis | URL | Durum |
|--------|-----|-------|
| Worker | `https://hukuk-worker.efearas06.workers.dev` | ✅ Canlı |
| R2 bucket | `hukuk-pdf` | ✅ 103 PDF, 587 MB |
| D1 database | `hukuk-db` @ EEUR | ✅ 6 tablo (boş) |
| Frontend | (yok) | ⏳ Vercel'e deploy bekliyor |

## İlk Kurulum (yapıldı, referans için)

1. Cloudflare hesabı + R2 bucket `hukuk-pdf` (dashboard'dan)
2. `cd worker && npx wrangler login`
3. `npx wrangler d1 create hukuk-db` → `database_id`'i `wrangler.toml`'a yaz
4. `npx wrangler d1 execute hukuk-db --remote --file=db/schema.sql`
5. R2 API token (Object Read & Write, hukuk-pdf scope) → `scripts/.env`
6. `cd scripts && pnpm upload-pdfs` (590 MB, ~10 dk)
7. workers.dev subdomain seç (one-time)
8. `cd worker && pnpm deploy`

## Worker Deploy (her güncellemede)

```bash
cd /Users/efekarakoyun/hukukçalışma/uygulama
pnpm --filter ./worker deploy
```

Output: deploy ID + URL. SSL cert ilk deploy'dan sonra 1-5 dk içinde aktif olur.

## Worker Secrets (Sprint 1+ için)

```bash
cd worker
npx wrangler secret put AUTH_SECRET     # openssl rand -hex 32
npx wrangler secret put APP_PASSWORD    # giriş şifresi
npx wrangler secret put GEMINI_API_KEY  # AI chat için
npx wrangler secret put ANTHROPIC_API_KEY # fallback
```

## Frontend Deploy (Sprint 0.5 — Vercel)

```bash
# İlk sefer
cd frontend
npx vercel
# Prompts:
# - Set up & deploy? Y
# - Which scope? (kişisel)
# - Link to existing project? N
# - Project name: hukuk-efe
# - Directory: ./
# - Build settings: default (Next.js detect edilir)
```

Vercel dashboard'a git → Settings → Environment Variables:
- `NEXT_PUBLIC_WORKER_URL = https://hukuk-worker.efearas06.workers.dev`

Sonra:
```bash
npx vercel --prod
```

## D1 Backup

D1 export:
```bash
cd worker
npx wrangler d1 export hukuk-db --remote --output=backup-$(date +%Y%m%d).sql
```

Restore:
```bash
npx wrangler d1 execute hukuk-db --remote --file=backup-YYYYMMDD.sql
```

## Maliyet Takibi

- Worker requests: <100K/gün → free tier
- R2 storage: 587 MB / 10 GB free → ~6%
- R2 ops (Class A — yazma): tek seferlik 103 upload
- R2 ops (Class B — okuma): kullanım kadarı, 10M/ay free
- D1 storage: <50 MB / 5 GB free
- D1 reads: <5M/ay free

Cloudflare dashboard → Workers & Pages → Analytics ile takip et.
