# Sprint 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Çalışan bir monorepo iskeleti — Next.js PWA frontend, Cloudflare Worker backend, R2 (PDF) + D1 (state) entegrasyonları, tek-kullanıcı şifre auth. Sonunda telefon+Mac'ten açılabilir, "Merhaba Efe" gösteren ve Worker'a ping atan bir uygulama olacak.

**Architecture:** pnpm monorepo. `frontend/` Vercel'e deploy edilen Next.js 15 App Router (Tailwind + shadcn + PWA). `worker/` Cloudflare'e deploy edilen Hono tabanlı Worker. Worker D1'i state için, R2'yi PDF için kullanır. Frontend ↔ Worker arası fetch.

**Tech Stack:**
- Frontend: Next.js 15.5, TypeScript, Tailwind 4, shadcn/ui, @ducanh2912/next-pwa, jose (JWT)
- Worker: Hono 4, @cloudflare/workers-types, Wrangler 4
- Storage: Cloudflare D1 + R2
- Tooling: pnpm 10, Vitest, ESLint, Prettier

---

## File Structure (oluşturulacak)

```
uygulama/
├── .gitignore                          # Task 1
├── .editorconfig                       # Task 1
├── pnpm-workspace.yaml                 # Task 1
├── package.json                        # Task 1 (root scripts)
├── README.md                           # Task 11
├── docs/
│   ├── DEVELOPMENT.md                  # Task 11
│   └── DEPLOY.md                       # Task 11
├── frontend/
│   ├── package.json                    # Task 2 (auto-generated)
│   ├── next.config.ts                  # Task 3 (modified for PWA)
│   ├── tsconfig.json                   # Task 2
│   ├── postcss.config.mjs              # Task 2
│   ├── app/
│   │   ├── layout.tsx                  # Task 3 (PWA metadata)
│   │   ├── page.tsx                    # Task 9 (worker ping)
│   │   ├── login/page.tsx              # Task 10
│   │   └── globals.css                 # Task 2
│   ├── components/ui/                  # Task 2 (shadcn install)
│   ├── lib/
│   │   ├── api.ts                      # Task 9
│   │   └── auth.ts                     # Task 10
│   ├── middleware.ts                   # Task 10
│   ├── public/
│   │   ├── manifest.json               # Task 3
│   │   └── icons/                      # Task 3
│   └── .env.local                      # Task 9, 10
├── worker/
│   ├── package.json                    # Task 4
│   ├── wrangler.toml                   # Task 4, 6, 7
│   ├── tsconfig.json                   # Task 4
│   ├── src/
│   │   ├── index.ts                    # Task 4, 5, 10
│   │   ├── routes/
│   │   │   ├── health.ts               # Task 5
│   │   │   ├── pdf.ts                  # Task 7
│   │   │   └── sync.ts                 # Task 6
│   │   └── lib/
│   │       └── auth.ts                 # Task 10
│   ├── db/
│   │   ├── schema.sql                  # Task 6
│   │   └── migrations/0001_init.sql    # Task 6
│   ├── tests/
│   │   └── health.test.ts              # Task 8
│   └── vitest.config.ts                # Task 8
└── scripts/
    └── upload-pdfs.ts                  # Task 7
```

---

## Task 1: Monorepo Init + Git

**Files:**
- Create: `uygulama/.gitignore`
- Create: `uygulama/.editorconfig`
- Create: `uygulama/pnpm-workspace.yaml`
- Create: `uygulama/package.json`

- [ ] **Step 1: Init git**

```bash
cd /Users/efekarakoyun/hukukçalışma/uygulama
git init
git branch -M main
```

Expected: `Initialized empty Git repository`

- [ ] **Step 2: Write .gitignore**

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Builds
.next/
.vercel/
dist/
build/

# Cloudflare
.wrangler/
.dev.vars

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db

# Generated data (large, regeneratable)
data/embeddings/
data/*.bin

# PDFs (in R2, not in repo)
*.pdf

# Test coverage
coverage/

# Logs
*.log
```

- [ ] **Step 3: Write .editorconfig**

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 4: Write pnpm-workspace.yaml**

```yaml
packages:
  - "frontend"
  - "worker"
```

- [ ] **Step 5: Write root package.json**

```json
{
  "name": "hukuk-calisma",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@10.10.0",
  "scripts": {
    "dev": "pnpm --parallel --filter './frontend' --filter './worker' dev",
    "dev:frontend": "pnpm --filter ./frontend dev",
    "dev:worker": "pnpm --filter ./worker dev",
    "build": "pnpm --filter ./frontend build && pnpm --filter ./worker build",
    "test": "pnpm --filter ./worker test",
    "deploy:frontend": "pnpm --filter ./frontend deploy",
    "deploy:worker": "pnpm --filter ./worker deploy"
  }
}
```

- [ ] **Step 6: First commit**

```bash
git add -A
git commit -m "chore: init monorepo with pnpm workspaces and project hygiene"
```

Expected: Commit succeeds with 5 files.

---

## Task 2: Frontend Next.js + shadcn/ui Init

**Files:**
- Create: `frontend/` (entire scaffold)
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Scaffold Next.js into frontend/**

```bash
cd /Users/efekarakoyun/hukukçalışma/uygulama
pnpm create next-app@latest frontend \
  --typescript --tailwind --app --use-pnpm \
  --no-eslint --turbopack --src-dir=false --import-alias="@/*"
```

Expected: `frontend/` populated. Confirm files exist:
```bash
ls frontend/app/page.tsx frontend/package.json
```

- [ ] **Step 2: Install shadcn/ui**

```bash
cd frontend
pnpm dlx shadcn@latest init --defaults --yes
```

If prompted, pick: `New York`, `Neutral`, CSS variables `yes`.

- [ ] **Step 3: Add base shadcn components**

```bash
pnpm dlx shadcn@latest add button card input label
```

Creates: `frontend/components/ui/{button,card,input,label}.tsx`

- [ ] **Step 4: Write "Merhaba Efe" page**

Overwrite `frontend/app/page.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="min-h-screen p-6 flex items-center justify-center bg-background">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Merhaba Efe 👋</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Hukuk çalışma uygulaması iskeleti çalışıyor.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 5: Manuel test**

```bash
cd /Users/efekarakoyun/hukukçalışma/uygulama
pnpm dev:frontend
```

Tarayıcıda `http://localhost:3000` aç. "Merhaba Efe" kartı görünmeli. `Ctrl+C` ile dur.

- [ ] **Step 6: Commit**

```bash
cd /Users/efekarakoyun/hukukçalışma/uygulama
git add -A
git commit -m "feat(frontend): scaffold Next.js 15 + Tailwind + shadcn/ui"
```

---

## Task 3: PWA Configuration

**Files:**
- Create: `frontend/public/manifest.json`
- Create: `frontend/public/icons/icon-192.png`, `icon-512.png` (placeholder OK)
- Modify: `frontend/app/layout.tsx`
- Modify: `frontend/next.config.ts`
- Install: `@ducanh2912/next-pwa`

- [ ] **Step 1: Write manifest.json**

`frontend/public/manifest.json`:

```json
{
  "name": "Hukuk Çalışma",
  "short_name": "Hukuk",
  "description": "Kişisel hukuk sınav hazırlık platformu",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 2: Generate placeholder icons**

```bash
cd /Users/efekarakoyun/hukukçalışma/uygulama/frontend
mkdir -p public/icons
# Üret 192x192 ve 512x512 — basit "H" placeholder
python3 <<'PY'
from PIL import Image, ImageDraw, ImageFont
for size in [192, 512]:
    img = Image.new('RGB', (size, size), color='#0a0a0a')
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", size // 2)
    except:
        font = ImageFont.load_default()
    text = "H"
    bbox = draw.textbbox((0,0), text, font=font)
    w, h = bbox[2]-bbox[0], bbox[3]-bbox[1]
    draw.text(((size-w)/2 - bbox[0], (size-h)/2 - bbox[1]), text, fill='#ffffff', font=font)
    img.save(f'public/icons/icon-{size}.png')
print("OK")
PY
```

(Pillow gerek: `pip3 install Pillow` ya da `brew install pillow`.)

- [ ] **Step 3: Update layout.tsx metadata**

`frontend/app/layout.tsx` içinde mevcut `metadata` exportunu değiştir:

```tsx
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Hukuk Çalışma",
  description: "Kişisel hukuk sınav hazırlık platformu",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Hukuk",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};
```

- [ ] **Step 4: Install + configure next-pwa**

```bash
cd /Users/efekarakoyun/hukukçalışma/uygulama/frontend
pnpm add @ducanh2912/next-pwa
```

`frontend/next.config.ts`:

```ts
import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  workboxOptions: { skipWaiting: true },
});

const nextConfig: NextConfig = {};

export default withPWA(nextConfig);
```

- [ ] **Step 5: Verify**

```bash
cd /Users/efekarakoyun/hukukçalışma/uygulama
pnpm --filter ./frontend build
pnpm --filter ./frontend start
```

Tarayıcıda `http://localhost:3000` → DevTools → Application → Manifest. "Hukuk Çalışma" görünmeli. Service Worker'da `sw.js` register olmalı.

- [ ] **Step 6: Commit**

```bash
cd /Users/efekarakoyun/hukukçalışma/uygulama
git add -A
git commit -m "feat(frontend): PWA manifest, icons, service worker"
```

---

## Task 4: Worker Init (Hono)

**Files:**
- Create: `worker/package.json`, `worker/wrangler.toml`, `worker/tsconfig.json`
- Create: `worker/src/index.ts`

- [ ] **Step 1: Scaffold worker manually (daha kontrollü)**

```bash
cd /Users/efekarakoyun/hukukçalışma/uygulama
mkdir -p worker/src
cd worker
pnpm init
pnpm add hono
pnpm add -D wrangler @cloudflare/workers-types typescript
```

- [ ] **Step 2: tsconfig.json**

`worker/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: wrangler.toml (D1 ve R2 sonra eklenecek)**

`worker/wrangler.toml`:

```toml
name = "hukuk-worker"
main = "src/index.ts"
compatibility_date = "2026-05-01"
compatibility_flags = ["nodejs_compat"]

[observability]
enabled = true

# D1 binding — Task 6'da doldurulacak
# [[d1_databases]]
# binding = "DB"
# database_name = "hukuk-db"
# database_id = "<TASK_6'DA EKLE>"

# R2 binding — Task 7'de doldurulacak
# [[r2_buckets]]
# binding = "PDF_BUCKET"
# bucket_name = "hukuk-pdf"
```

- [ ] **Step 4: src/index.ts (minimal)**

`worker/src/index.ts`:

```ts
import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  // DB: D1Database;          // Task 6
  // PDF_BUCKET: R2Bucket;    // Task 7
  // AUTH_SECRET: string;     // Task 10
  // GEMINI_KEY: string;      // sonra
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors({ origin: "*" })); // dev için; prod'da kısılacak

app.get("/", (c) => c.text("Hukuk Worker"));

export default app;
```

- [ ] **Step 5: package.json scripts**

`worker/package.json` içine "scripts" ekle:

```json
{
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 6: Test local**

```bash
cd /Users/efekarakoyun/hukukçalışma/uygulama
pnpm --filter ./worker dev
```

Başka terminalde:
```bash
curl http://localhost:8787
```

Expected: `Hukuk Worker`

- [ ] **Step 7: Commit**

```bash
cd /Users/efekarakoyun/hukukçalışma/uygulama
git add -A
git commit -m "feat(worker): scaffold Hono on Cloudflare Workers"
```

---

## Task 5: Health Endpoint

**Files:**
- Create: `worker/src/routes/health.ts`
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Write health route**

`worker/src/routes/health.ts`:

```ts
import { Hono } from "hono";

export const health = new Hono();

health.get("/", (c) =>
  c.json({
    status: "ok",
    ts: new Date().toISOString(),
    region: c.req.raw.cf?.colo ?? "unknown",
  })
);
```

- [ ] **Step 2: Mount in index.ts**

`worker/src/index.ts` güncelle:

```ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { health } from "./routes/health";

type Bindings = {};

const app = new Hono<{ Bindings: Bindings }>();
app.use("*", cors({ origin: "*" }));

app.get("/", (c) => c.text("Hukuk Worker"));
app.route("/health", health);

export default app;
```

- [ ] **Step 3: Test**

```bash
pnpm --filter ./worker dev
curl http://localhost:8787/health
```

Expected: `{"status":"ok","ts":"2026-05-25T...","region":"unknown"}`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(worker): add /health endpoint"
```

---

## Task 6: D1 Database Setup

**Files:**
- Create: `worker/db/schema.sql`, `worker/db/migrations/0001_init.sql`
- Create: `worker/src/routes/sync.ts`
- Modify: `worker/wrangler.toml`, `worker/src/index.ts`

- [ ] **Step 1: Create D1 database**

```bash
cd /Users/efekarakoyun/hukukçalışma/uygulama/worker
npx wrangler login   # Tarayıcıda Cloudflare girişi
npx wrangler d1 create hukuk-db
```

Expected çıktı:
```
[[d1_databases]]
binding = "DB"
database_name = "hukuk-db"
database_id = "abc123..."
```

`database_id`'i not al.

- [ ] **Step 2: Add D1 binding to wrangler.toml**

`worker/wrangler.toml` yorum satırlarını aç ve `database_id` yapıştır:

```toml
[[d1_databases]]
binding = "DB"
database_name = "hukuk-db"
database_id = "<YUKARIDAKİ_ID>"
```

- [ ] **Step 3: Write schema.sql**

`worker/db/schema.sql`:

```sql
-- Quiz attempts
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  course TEXT NOT NULL,
  topic TEXT,
  question_id TEXT NOT NULL,
  selected_answer INTEGER NOT NULL,
  is_correct INTEGER NOT NULL,    -- 0/1
  created_at INTEGER NOT NULL     -- unix ms
);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_course ON quiz_attempts(course);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_ts ON quiz_attempts(created_at);

-- Flashcard SRS state
CREATE TABLE IF NOT EXISTS flashcard_state (
  card_id TEXT PRIMARY KEY,
  course TEXT NOT NULL,
  ease REAL NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 0,
  next_review INTEGER NOT NULL,   -- unix ms
  last_seen INTEGER,
  streak INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_flashcard_next ON flashcard_state(next_review);

-- AI chat history
CREATE TABLE IF NOT EXISTS chat_history (
  id TEXT PRIMARY KEY,
  course TEXT,
  pdf_key TEXT,
  selected_text TEXT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sources TEXT,                   -- JSON array
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_course ON chat_history(course);

-- Study plan
CREATE TABLE IF NOT EXISTS study_plan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,             -- YYYY-MM-DD
  course TEXT NOT NULL,
  topic TEXT,
  target_min INTEGER NOT NULL,
  actual_min INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_plan_date ON study_plan(date);

-- Pomodoro sessions
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id TEXT PRIMARY KEY,
  course TEXT,
  duration_min INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER
);

-- Practice case responses (Modül 5)
CREATE TABLE IF NOT EXISTS practice_responses (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  user_solution TEXT NOT NULL,
  ai_feedback TEXT NOT NULL,
  score INTEGER,                  -- 0-100
  created_at INTEGER NOT NULL
);
```

- [ ] **Step 4: Copy as migration**

```bash
mkdir -p worker/db/migrations
cp worker/db/schema.sql worker/db/migrations/0001_init.sql
```

- [ ] **Step 5: Apply locally**

```bash
cd worker
npx wrangler d1 execute hukuk-db --local --file=db/schema.sql
```

Expected: `Executed 14 commands` (yaklaşık).

- [ ] **Step 6: Apply remote**

```bash
npx wrangler d1 execute hukuk-db --remote --file=db/schema.sql
```

- [ ] **Step 7: Write sync route**

`worker/src/routes/sync.ts`:

```ts
import { Hono } from "hono";

type Bindings = { DB: D1Database };

export const sync = new Hono<{ Bindings: Bindings }>();

sync.get("/status", async (c) => {
  const tables = ["quiz_attempts", "flashcard_state", "chat_history", "study_plan"];
  const counts: Record<string, number> = {};
  for (const t of tables) {
    const r = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first<{ n: number }>();
    counts[t] = r?.n ?? -1;
  }
  return c.json({ status: "ok", counts });
});
```

- [ ] **Step 8: Mount sync in index.ts**

`worker/src/index.ts` güncelle:

```ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { health } from "./routes/health";
import { sync } from "./routes/sync";

type Bindings = { DB: D1Database };

const app = new Hono<{ Bindings: Bindings }>();
app.use("*", cors({ origin: "*" }));

app.get("/", (c) => c.text("Hukuk Worker"));
app.route("/health", health);
app.route("/sync", sync);

export default app;
```

- [ ] **Step 9: Test**

```bash
pnpm --filter ./worker dev
curl http://localhost:8787/sync/status
```

Expected: `{"status":"ok","counts":{"quiz_attempts":0,"flashcard_state":0,...}}`

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(worker): D1 schema + /sync/status route"
```

---

## Task 7: R2 Bucket + PDF Upload

**Files:**
- Modify: `worker/wrangler.toml`
- Create: `worker/src/routes/pdf.ts`
- Modify: `worker/src/index.ts`
- Create: `scripts/upload-pdfs.ts`

> **Prerequisite:** R2 bucket `hukuk-pdf` Cloudflare dashboard'da oluşturulmuş olmalı (Efe yaptı). Yeni API token oluşturulup credentials elde edilmiş olmalı.

- [ ] **Step 1: Add R2 binding to wrangler.toml**

`worker/wrangler.toml`:

```toml
[[r2_buckets]]
binding = "PDF_BUCKET"
bucket_name = "hukuk-pdf"
```

- [ ] **Step 2: Write PDF route**

`worker/src/routes/pdf.ts`:

```ts
import { Hono } from "hono";

type Bindings = { PDF_BUCKET: R2Bucket };

export const pdf = new Hono<{ Bindings: Bindings }>();

pdf.get("/list", async (c) => {
  const prefix = c.req.query("prefix") ?? "";
  const list = await c.env.PDF_BUCKET.list({ prefix, limit: 1000 });
  return c.json({
    objects: list.objects.map((o) => ({
      key: o.key,
      size: o.size,
      uploaded: o.uploaded.toISOString(),
    })),
    truncated: list.truncated,
  });
});

pdf.get("/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const obj = await c.env.PDF_BUCKET.get(key);
  if (!obj) return c.notFound();

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("Cache-Control", "public, max-age=86400");
  return new Response(obj.body, { headers });
});
```

- [ ] **Step 3: Mount in index.ts**

`worker/src/index.ts` güncelle (Bindings'e PDF_BUCKET ekle, route mount):

```ts
import { pdf } from "./routes/pdf";

type Bindings = { DB: D1Database; PDF_BUCKET: R2Bucket };
// ...
app.route("/pdf", pdf);
```

- [ ] **Step 4: Write upload script**

```bash
cd /Users/efekarakoyun/hukukçalışma/uygulama
mkdir -p scripts
cd scripts
pnpm init
pnpm add @aws-sdk/client-s3 mime-types
pnpm add -D tsx @types/node @types/mime-types
```

`scripts/upload-pdfs.ts`:

```ts
import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import mime from "mime-types";

const ENDPOINT = process.env.R2_ENDPOINT!;
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID!;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const BUCKET = process.env.R2_BUCKET ?? "hukuk-pdf";
const SOURCE_DIR = process.env.SOURCE_DIR ?? "/Users/efekarakoyun/hukukçalışma/resources/dersler";

if (!ENDPOINT || !ACCESS_KEY || !SECRET_KEY) {
  console.error("Missing env: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY");
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: ENDPOINT,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
});

function* walkPdfs(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walkPdfs(full);
    else if (entry.toLowerCase().endsWith(".pdf")) yield full;
  }
}

async function alreadyUploaded(): Promise<Set<string>> {
  const seen = new Set<string>();
  let token: string | undefined;
  do {
    const r = await client.send(new ListObjectsV2Command({
      Bucket: BUCKET, ContinuationToken: token,
    }));
    r.Contents?.forEach((o) => o.Key && seen.add(o.Key));
    token = r.NextContinuationToken;
  } while (token);
  return seen;
}

async function main() {
  const existing = await alreadyUploaded();
  console.log(`Mevcut: ${existing.size} dosya`);

  let uploaded = 0, skipped = 0, failed = 0;
  for (const fullPath of walkPdfs(SOURCE_DIR)) {
    const key = `dersler/${relative(SOURCE_DIR, fullPath)}`;
    if (existing.has(key)) { skipped++; continue; }

    const body = readFileSync(fullPath);
    const contentType = mime.lookup(fullPath) || "application/pdf";
    try {
      await client.send(new PutObjectCommand({
        Bucket: BUCKET, Key: key, Body: body, ContentType: contentType,
      }));
      uploaded++;
      console.log(`✓ ${key} (${(body.length/1e6).toFixed(1)} MB)`);
    } catch (e) {
      failed++;
      console.error(`✗ ${key}: ${e}`);
    }
  }
  console.log(`\nÖzet: ${uploaded} yüklendi, ${skipped} atlandı, ${failed} hata`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

`scripts/package.json` içine script ekle:

```json
{
  "scripts": {
    "upload-pdfs": "tsx upload-pdfs.ts"
  }
}
```

- [ ] **Step 5: Run upload (Efe credentials verince)**

`.env` dosyası oluştur (`scripts/.env`, **.gitignore'da**):

```bash
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<YENİ_ACCESS_KEY>
R2_SECRET_ACCESS_KEY=<YENİ_SECRET>
R2_BUCKET=hukuk-pdf
```

Çalıştır:
```bash
cd scripts
export $(cat .env | xargs)
pnpm upload-pdfs
```

Expected: ~100 PDF, ~590 MB upload. Süre: bağlantıya göre 5-15 dakika.

- [ ] **Step 6: Test PDF route**

Önce remote'a deploy etmemiz lazım:
```bash
pnpm --filter ./worker deploy
```

Dağıtım URL'ini al (örn. `https://hukuk-worker.efearas06.workers.dev`). Test:
```bash
curl https://hukuk-worker.efearas06.workers.dev/pdf/list?prefix=dersler/miras_hukuku/
```

Expected: Miras klasöründeki PDF listesini JSON döner.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(worker): R2 PDF serve + upload script"
```

---

## Task 8: Worker Tests (Vitest)

**Files:**
- Create: `worker/vitest.config.ts`, `worker/tests/health.test.ts`

- [ ] **Step 1: Install vitest**

```bash
cd /Users/efekarakoyun/hukukçalışma/uygulama/worker
pnpm add -D vitest @cloudflare/vitest-pool-workers
```

- [ ] **Step 2: vitest.config.ts**

`worker/vitest.config.ts`:

```ts
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
      },
    },
  },
});
```

- [ ] **Step 3: Write failing test**

`worker/tests/health.test.ts`:

```ts
import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("/health", () => {
  it("returns status ok", async () => {
    const r = await SELF.fetch("https://example.com/health");
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j).toMatchObject({ status: "ok" });
    expect(typeof (j as any).ts).toBe("string");
  });
});
```

- [ ] **Step 4: Add test script + run**

`worker/package.json` scripts'e:
```json
"test": "vitest run"
```

Çalıştır:
```bash
pnpm --filter ./worker test
```

Expected: 1 test passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(worker): vitest setup + health test"
```

---

## Task 9: Frontend ↔ Worker Bridge

**Files:**
- Create: `frontend/lib/api.ts`
- Create: `frontend/.env.local`
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Write API client**

`frontend/lib/api.ts`:

```ts
const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? "http://localhost:8787";

export async function fetchWorker<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${WORKER_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!r.ok) throw new Error(`Worker ${path}: ${r.status}`);
  return r.json() as Promise<T>;
}

export type HealthResponse = { status: string; ts: string; region: string };

export const api = {
  health: () => fetchWorker<HealthResponse>("/health"),
};
```

- [ ] **Step 2: Set env var**

`frontend/.env.local`:

```bash
NEXT_PUBLIC_WORKER_URL=http://localhost:8787
```

(Prod'da Vercel env'de gerçek Worker URL'i set edilecek.)

- [ ] **Step 3: Update page.tsx to ping**

`frontend/app/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type HealthResponse } from "@/lib/api";

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.health().then(setHealth).catch((e) => setError(String(e)));
  }, []);

  return (
    <main className="min-h-screen p-6 flex items-center justify-center bg-background">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Merhaba Efe 👋</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-muted-foreground">Hukuk çalışma uygulaması iskeleti.</p>
          {health && (
            <div className="text-sm space-y-1">
              <p>Worker: <span className="text-green-500">●</span> {health.status}</p>
              <p className="text-muted-foreground">Region: {health.region}</p>
              <p className="text-muted-foreground">TS: {health.ts}</p>
            </div>
          )}
          {error && <p className="text-sm text-red-500">Worker hata: {error}</p>}
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 4: Test (her ikisi de çalışır halde)**

Bir terminal:
```bash
pnpm dev:worker
```

Başka terminal:
```bash
pnpm dev:frontend
```

`http://localhost:3000` → "Worker: ● ok" + region görünmeli.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: frontend-worker bridge with health ping"
```

---

## Task 10: Single-User Auth Gate

**Files:**
- Create: `frontend/middleware.ts`, `frontend/app/login/page.tsx`, `frontend/lib/auth.ts`
- Create: `worker/src/lib/auth.ts`
- Modify: `worker/src/index.ts`, `frontend/app/page.tsx`, `frontend/.env.local`

- [ ] **Step 1: Generate secret**

```bash
openssl rand -hex 32
```

Çıkan değeri kopyala. **Bu, AUTH_SECRET.**

- [ ] **Step 2: Set secret on Worker**

```bash
cd worker
npx wrangler secret put AUTH_SECRET
# Yapıştır: <yukarıdaki hex>
```

- [ ] **Step 3: Worker auth middleware**

`worker/src/lib/auth.ts`:

```ts
import { jwt, sign as honoSign } from "hono/jwt";
import type { MiddlewareHandler } from "hono";

export const requireAuth = (): MiddlewareHandler =>
  jwt({ secret: (c: any) => c.env.AUTH_SECRET, cookie: "auth" });

export async function signToken(secret: string, sub = "efe"): Promise<string> {
  return honoSign({ sub, iat: Math.floor(Date.now() / 1000) }, secret);
}
```

- [ ] **Step 4: Add login route + protect existing routes**

`worker/src/index.ts` güncelle:

```ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { setCookie } from "hono/cookie";
import { health } from "./routes/health";
import { sync } from "./routes/sync";
import { pdf } from "./routes/pdf";
import { requireAuth, signToken } from "./lib/auth";

type Bindings = { DB: D1Database; PDF_BUCKET: R2Bucket; AUTH_SECRET: string; APP_PASSWORD: string };

const app = new Hono<{ Bindings: Bindings }>();
app.use("*", cors({ origin: "*", credentials: true }));

// Public
app.get("/", (c) => c.text("Hukuk Worker"));
app.route("/health", health);

app.post("/auth/login", async (c) => {
  const { password } = await c.req.json<{ password: string }>();
  if (password !== c.env.APP_PASSWORD) return c.json({ error: "wrong" }, 401);
  const token = await signToken(c.env.AUTH_SECRET);
  setCookie(c, "auth", token, { httpOnly: true, secure: true, sameSite: "Lax", maxAge: 60 * 60 * 24 * 30 });
  return c.json({ ok: true });
});

// Protected
app.use("/sync/*", requireAuth());
app.use("/pdf/*", requireAuth());
app.route("/sync", sync);
app.route("/pdf", pdf);

export default app;
```

`APP_PASSWORD`'ı da set et:
```bash
npx wrangler secret put APP_PASSWORD
# Yapıştır: <kullanıcının seçtiği şifre>
```

- [ ] **Step 5: Frontend login page**

`frontend/app/login/page.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const r = await fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!r.ok) return setErr("Hatalı şifre");
    router.push("/");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-sm w-full">
        <CardHeader><CardTitle>Giriş</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pw">Şifre</Label>
              <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {err && <p className="text-sm text-red-500">{err}</p>}
            <Button type="submit" className="w-full">Gir</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 6: Frontend middleware (auth cookie kontrol)**

`frontend/middleware.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const isLogin = req.nextUrl.pathname.startsWith("/login");
  const hasAuth = req.cookies.has("auth");
  if (!hasAuth && !isLogin) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (hasAuth && isLogin) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next|favicon.ico|manifest.json|icons).*)"] };
```

> Not: Middleware sadece cookie varlığını kontrol eder, JWT doğrulama Worker tarafında yapılır. (Edge'de jose çalıştırılabilir ama YAGNI.)

- [ ] **Step 7: Update fetchWorker to send credentials**

`frontend/lib/api.ts` güncelle:

```ts
const r = await fetch(`${WORKER_URL}${path}`, {
  credentials: "include",
  ...init,
  headers: { "Content-Type": "application/json", ...init?.headers },
});
```

- [ ] **Step 8: Test end-to-end**

```bash
# Terminal 1
pnpm dev:worker

# Terminal 2
pnpm dev:frontend
```

`http://localhost:3000` → `/login` redirect olur → şifre gir → ana sayfaya döner → Worker health görünür.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: single-user password auth with JWT cookie"
```

---

## Task 11: README + Operasyon Dokümanları

**Files:**
- Create: `uygulama/README.md`, `docs/DEVELOPMENT.md`, `docs/DEPLOY.md`

- [ ] **Step 1: README.md**

`uygulama/README.md`:

````markdown
# Hukuk Çalışma Uygulaması

Kişisel hukuk sınav (finaller + HMGS) hazırlık PWA'sı. Tek kullanıcı, 4 ay (Mayıs-Eylül 2026).

## Stack
- **Frontend:** Next.js 15 PWA (Vercel)
- **Backend:** Cloudflare Worker (Hono)
- **Storage:** Cloudflare R2 (PDF) + D1 (state)
- **AI:** Gemini Flash → Anthropic Haiku fallback

## Hızlı Başlangıç

```bash
pnpm install
pnpm dev   # frontend (3000) + worker (8787) paralel
```

## Yapı
- `frontend/` — Next.js
- `worker/` — Cloudflare Worker (Hono)
- `scripts/` — One-shot scripts (PDF upload, embeddings vb.)
- `spec/` — Tasarım dokümanları
- `plans/` — İmplementasyon planları
- `docs/` — Operasyon dokümanları

## Geliştirme
Bkz. `docs/DEVELOPMENT.md`

## Deploy
Bkz. `docs/DEPLOY.md`
````

- [ ] **Step 2: DEVELOPMENT.md**

`docs/DEVELOPMENT.md`:

````markdown
# Geliştirme

## Gereksinimler
- Node 22+ (test edildi: v24)
- pnpm 10+
- Wrangler (worker/ içinde)
- Cloudflare hesabı (D1 + R2 + Workers)

## Kurulum

```bash
pnpm install
cp frontend/.env.local.example frontend/.env.local
cp scripts/.env.example scripts/.env
```

## Çalıştırma

```bash
pnpm dev              # her ikisi paralel
pnpm dev:frontend     # sadece frontend
pnpm dev:worker       # sadece worker
```

- Frontend: http://localhost:3000
- Worker:   http://localhost:8787

## D1 Migration

```bash
cd worker
npx wrangler d1 execute hukuk-db --local --file=db/schema.sql
npx wrangler d1 execute hukuk-db --remote --file=db/schema.sql
```

## R2 PDF Upload

```bash
cd scripts
export $(cat .env | xargs)
pnpm upload-pdfs
```

## Test

```bash
pnpm test   # worker tests
```
````

- [ ] **Step 3: DEPLOY.md**

`docs/DEPLOY.md`:

````markdown
# Deploy

## İlk Setup
1. Cloudflare hesabı + R2 bucket `hukuk-pdf` (Cloudflare dashboard)
2. `wrangler login`
3. `wrangler d1 create hukuk-db` → `database_id`'i `wrangler.toml`'a yaz
4. Secrets:
   ```bash
   cd worker
   wrangler secret put AUTH_SECRET     # openssl rand -hex 32
   wrangler secret put APP_PASSWORD    # giriş şifresi
   wrangler secret put GEMINI_KEY      # ileri sprintlerde
   ```
5. PDF'leri R2'ye yükle (bkz. DEVELOPMENT)

## Worker Deploy
```bash
pnpm --filter ./worker deploy
```
Çıktı URL'i: `https://hukuk-worker.<ACCOUNT>.workers.dev`

## Frontend Deploy (Vercel)
1. Vercel CLI: `npm i -g vercel`
2. `cd frontend && vercel`
3. Vercel dashboard'da env:
   - `NEXT_PUBLIC_WORKER_URL` = Worker URL'i
4. Production deploy: `vercel --prod`

## Domain (opsiyonel)
- Frontend: Vercel'de custom domain (`hukuk.efe.dev` gibi)
- Worker: Workers route ile aynı domain alt-path'i (`/api/*`) bağlanabilir
````

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: README + DEVELOPMENT + DEPLOY"
```

---

## Doğrulama (Sprint 0 bitti mi?)

- [ ] `pnpm install` hata yok
- [ ] `pnpm dev` çalışır (frontend + worker paralel)
- [ ] http://localhost:3000 → login sayfası → şifre → ana sayfaya yönlendirir → Worker health "ok" görünür
- [ ] `pnpm test` (worker tests) yeşil
- [ ] `pnpm --filter ./worker deploy` başarılı, URL erişilebilir
- [ ] R2 bucket `hukuk-pdf` içinde 100+ PDF (yükleme yapıldıysa)
- [ ] D1 schema deployed (`SELECT name FROM sqlite_master` listede 7 tablo)
- [ ] Vercel'e deploy yapıldı (telefon Safari'den açılır)

---

## Sonraki Sprint Bağlantısı

Sprint 0 biter bitmez: **Sprint 1 — Modül 3 (PDF Reader + AI Chat)** planı yazılacak. Bu, finals için en kritik modül. Hafta 2-3'te tamamlanmalı.

Bağımlılıklar Sprint 1 için hazır:
- ✅ R2'de PDF'ler
- ✅ Worker auth
- ✅ D1 chat_history tablosu
- ⏳ Embedding üretimi (Sprint 1 başı)
- ⏳ AI proxy route (Sprint 1)
