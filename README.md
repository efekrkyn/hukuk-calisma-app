# Hukuk Çalışma Uygulaması

Tek kullanıcı (Efe), 4 ay (Mayıs–Eylül 2026), hukuk finalleri + HMGS sınavı için kişisel hazırlık PWA'sı.

## Stack
- **Frontend:** Next.js 16 + Tailwind 4 + shadcn/ui + PWA (Vercel)
- **Backend:** Cloudflare Worker + Hono
- **Storage:** Cloudflare R2 (PDF) + D1 (state)
- **AI:** Gemini Flash → Anthropic Haiku fallback (Sprint 1'de)

## Canlı URL'ler
| Servis | URL |
|--------|-----|
| Worker | https://hukuk-worker.efearas06.workers.dev |
| Frontend | (Sprint 0.5'te Vercel'e deploy) |

## Hızlı Başlangıç

```bash
pnpm install
pnpm dev          # frontend (:3000) + worker (:8787) paralel
```

## Yapı

```
uygulama/
├── frontend/       # Next.js PWA
├── worker/         # Cloudflare Worker (Hono)
├── scripts/        # PDF upload, embedding pipeline
├── spec/           # Tasarım dokümanları
├── plans/          # İmplementasyon planları
├── data/           # Generated content (questions, embeddings) — gitignored
└── docs/           # Operasyon dokümanları
```

## Sprint 0 Durumu (2026-05-25 itibariyle)

✅ Monorepo iskeleti (pnpm workspaces)
✅ Next.js 16 + Tailwind 4 + shadcn/ui + PWA
✅ Hono Worker, deploy edildi `hukuk-worker.efearas06.workers.dev`
✅ R2 bucket `hukuk-pdf`: 103 PDF, 587 MB
✅ D1 database `hukuk-db` (EEUR), 6 tablo
✅ Frontend ↔ Worker bridge (api.ts)
✅ Embedding pipeline iskeleti (scripts/embed-pdfs.ts)
⏳ Auth (Sprint 0.5)
⏳ Vercel deploy (Sprint 0.5)
⏳ Vitest (Sprint 1'de)

## Sonraki Sprintler

- **Sprint 0.5:** Auth (JWT cookie) + Vercel deploy
- **Sprint 1:** Modül 3 — PDF Reader + AI Chat (finals için kritik)
- **Sprint 2:** Modül 5 — Pratik Olay Çözücü
- **Sprint 3:** Modül 2 — Flashcard
- **Sprint 4-5:** Modül 1 — Quiz Engine + HMGS Mock
- **Sprint 6:** Modül 4 — Dashboard + Plan

## Dokümanlar
- [Tasarım](spec/2026-05-25-design.md)
- [Sprint 0 planı](plans/2026-05-25-foundation-plan.md)
- [Geliştirme](docs/DEVELOPMENT.md)
- [Deploy](docs/DEPLOY.md)
