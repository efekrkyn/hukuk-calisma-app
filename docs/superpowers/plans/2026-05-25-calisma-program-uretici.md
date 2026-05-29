# AI Çalışma Programı Üreticisi Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Execute tasks in order.

**Goal:** Efe'nin AÜHF 4. sınıf finalleri + HMGS hazırlığı için tek seferde sınav dönemine kadar saat-saat çalışma takvimi üreten, opsiyonel tikleme + manuel "yenile" destekli, Pomodoro'suz bir program üretici özelliği uygulamaya eklemek.

**Architecture:** Form input → DeepSeek V4 structured JSON → D1 immutable plan + ayrı opsiyonel tikler tablosu → 3 worker endpoint + 3 frontend route + ana sayfada bugün kartı. Spec referans: `docs/superpowers/specs/2026-05-25-calisma-program-uretici-design.md`.

**Tech Stack:** Cloudflare Workers + Hono + D1, Next.js 16 App Router, Tailwind 4, shadcn/ui, DeepSeek V4-Flash (mevcut `ai-provider.ts`'te), zod (worker validation), react-pdf yok (bu özellikte gerek yok).

**Test Stratejisi:** Projede otomatik test framework yok (proje sahibi kararı). Her task sonunda **manuel test step** + **canlı deploy** ile uçtan uca doğrulama. TDD step'leri yerine "verify by curl / browser" step'leri var.

---

## File Structure

### Yeni dosyalar (11)

| Dosya | Sorumluluk |
|---|---|
| `worker/db/migrations/002-study-plans.sql` | İki yeni tablo + indexler |
| `worker/src/lib/plan-schemas.ts` | zod schemas: FormInput, AiOutput |
| `worker/src/lib/plan-prompt.ts` | AI prompt builder fonksiyonu |
| `worker/src/lib/plan-store.ts` | D1 query'leri (insert/select/update plans + completions) |
| `worker/src/routes/plan.ts` | 3 endpoint: generate, toggle, active |
| `frontend/lib/plan-api.ts` | fetch wrappers + tipleri re-export |
| `frontend/types/plan.ts` | TypeScript tipleri (worker'dakilerle senkron) |
| `frontend/app/plan/setup/page.tsx` | 6 alanlı form sayfası |
| `frontend/app/plan/page.tsx` | Tam takvim viewer sayfası |
| `frontend/components/TodayCard.tsx` | Ana sayfaya gömülecek bugün kartı |
| `frontend/components/PlanGrid.tsx` | Haftalık ızgara + TaskCell child'lı |

### Modifiye edilecek dosyalar (2)

| Dosya | Değişiklik |
|---|---|
| `worker/src/index.ts` | `app.route("/plan", plan)` mount + `/ai/plan-generate` mount |
| `frontend/app/page.tsx` | TodayCard ekle + 4. buton "🗓️ Planım" |

---

## Task 1: D1 Migration

**Files:**
- Create: `worker/db/migrations/002-study-plans.sql`
- Test: D1 remote'a apply + SELECT ile doğrula

- [ ] **Step 1: Create migration file**

```sql
-- worker/db/migrations/002-study-plans.sql
-- AI Çalışma Programı Üreticisi — 2026-05-25

CREATE TABLE IF NOT EXISTS study_plans (
  id TEXT PRIMARY KEY,
  form_input TEXT NOT NULL,
  ai_output TEXT NOT NULL,
  ai_model TEXT NOT NULL,
  generated_at INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_study_plans_active
  ON study_plans(is_active, generated_at DESC);

CREATE TABLE IF NOT EXISTS study_task_completions (
  task_uuid TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  completed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_study_task_plan
  ON study_task_completions(plan_id);
```

- [ ] **Step 2: Apply to remote D1**

```bash
cd /Users/efekarakoyun/hukukçalışma/uygulama/worker
npx wrangler d1 execute hukuk-db --remote --file=db/migrations/002-study-plans.sql
```

Expected: `🌀 Mapping SQL input into an array of statements ... 🚣 Executed 4 commands in <Xms>` (4 = 2 CREATE TABLE + 2 CREATE INDEX).

- [ ] **Step 3: Verify both tables exist**

```bash
npx wrangler d1 execute hukuk-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('study_plans','study_task_completions')"
```

Expected output: 2 satır — `study_plans` ve `study_task_completions`.

- [ ] **Step 4: Commit**

```bash
git add worker/db/migrations/002-study-plans.sql
git commit -m "feat(d1): study_plans + study_task_completions migration"
```

---

## Task 2: Worker zod schemas

**Files:**
- Create: `worker/src/lib/plan-schemas.ts`

- [ ] **Step 1: Install zod if not present**

```bash
cd /Users/efekarakoyun/hukukçalışma/uygulama/worker
npm ls zod 2>&1 | head -3
```

Eğer zod yoksa:
```bash
npm i zod
```

- [ ] **Step 2: Write schemas file**

```typescript
// worker/src/lib/plan-schemas.ts
import { z } from "zod";

export const FormInputSchema = z.object({
  target_exam: z.enum(["final", "hmgs", "both"]),
  exam_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weeks_remaining: z.number().int().min(1).max(52),
  weekly_hours_weekday: z.number().min(0).max(12),
  weekly_hours_weekend: z.number().min(0).max(12),
  study_window_start: z.string().regex(/^\d{2}:\d{2}$/),
  study_window_end: z.string().regex(/^\d{2}:\d{2}$/),
  weak_courses: z.array(z.string()).max(21),
  notes: z.string().max(2000).default(""),
});

export type FormInput = z.infer<typeof FormInputSchema>;

const TaskSchema = z.object({
  uuid: z.string().min(8),
  time_start: z.string().regex(/^\d{2}:\d{2}$/),
  time_end: z.string().regex(/^\d{2}:\d{2}$/),
  course: z.string(),
  topic: z.string(),
  task_type: z.enum(["read", "practice", "review"]),
  target_ref: z.string().optional(),
  tip: z.string().optional(),
});

const DaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekday: z.string(),
  tasks: z.array(TaskSchema),
});

const WeekSchema = z.object({
  week_index: z.number().int().min(1),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.array(DaySchema),
});

export const AiOutputSchema = z.object({
  summary: z.string().min(1),
  weeks: z.array(WeekSchema).min(1),
});

export type AiOutput = z.infer<typeof AiOutputSchema>;

export const PracticeStatsSchema = z.array(
  z.object({
    course: z.string(),
    avg_score: z.number(),
    case_count: z.number().int(),
  })
);

export type PracticeStats = z.infer<typeof PracticeStatsSchema>;

export const TickHistorySchema = z.array(
  z.object({
    task_uuid: z.string(),
    course: z.string(),
    completed_at: z.number().int(),
  })
);

export type TickHistory = z.infer<typeof TickHistorySchema>;
```

- [ ] **Step 3: Type check worker**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: çıktı yok (boş = success).

- [ ] **Step 4: Commit**

```bash
git add worker/src/lib/plan-schemas.ts worker/package.json worker/package-lock.json
git commit -m "feat(worker): plan schemas (zod) — FormInput + AiOutput + stats"
```

---

## Task 3: Worker AI prompt builder

**Files:**
- Create: `worker/src/lib/plan-prompt.ts`

- [ ] **Step 1: Write prompt builder**

```typescript
// worker/src/lib/plan-prompt.ts
import type {
  FormInput,
  PracticeStats,
  TickHistory,
} from "./plan-schemas";

const SYSTEM_PROMPT = `Sen Türk hukuku öğrencisi Efe Karakoyun için kişiselleştirilmiş çalışma
programı üreten bir AI asistanısın. Efe AÜHF 4. sınıf öğrencisi, sınav
hazırlığında. Sen sadece program üretirsin — Pomodoro, motivasyon değil,
SAAT-SAAT NET ÇALIŞMA TAKVİMİ.

KURALLAR:
1. Çıktı SADECE JSON, başka metin yok. Markdown code fence YOK.
2. Şema: { summary: string, weeks: [...] }
3. Her hafta 7 gün, her gün 0-N task. Tasksız gün olabilir (haftalık tatil).
4. Saat blokları kullanıcının study_window_start–study_window_end arasında.
5. Bloklar 30/60/90 dakika; tek bir ders + konuya odaklı.
6. task_type üç değerden biri:
   - "read":     PDF okuma (ders kitabı veya kanun maddesi)
   - "practice": pratik case çözme
   - "review":   önceki haftanın özet/tekrarı
7. target_ref opsiyonel ama VARSA tıklanır link olacak:
   - "reader/<course>/<file>.pdf"  (ders kitabı)
   - "kanunlar/<slug>"              (kanun: anayasa, tbk, tmk, tck, cmk, hmk, ttk, ik, iik, iyuk, mohuk, vuk, avukatlik, fsek, sendika, tkhk)
   - "practice/<case_id>"           (pratik: borc_001 vb.)
8. tip opsiyonel: 1 cümle ipucu/odak (ör. "TBK m.49: kusurun 3 unsurunu listele").
9. Zayıf dersleri (weak_courses + düşük practice_stats) %30 daha fazla saat al.
10. Her hafta sonunda (genelde Cumartesi) 1 "review" task ekle.
11. Sınav tarihinden 1 hafta önce yoğunluk %50 artsın.
12. Saatler birbirine bitişik olmasın — minimum 15 dakika mola.
13. Her task'a benzersiz UUID üret (v4 format).
14. notes alanını dikkate al; "Salı 17 sonrası iş var" gibi kısıtları uygula.
15. tick_history varsa, kullanıcının hangi türde görevleri ardarda tikleme
    eğiliminde olduğunu gözet; o ders/konuya yatkınlık varsa hafifçe artır.

ÇIKTI ŞEMASI:
{
  "summary": "1-2 cümle plan özeti",
  "weeks": [
    {
      "week_index": 1,
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "days": [
        {
          "date": "YYYY-MM-DD",
          "weekday": "Pazartesi",
          "tasks": [
            {
              "uuid": "v4-uuid",
              "time_start": "HH:MM",
              "time_end": "HH:MM",
              "course": "borclar_genel",
              "topic": "TBK m.49 — haksız fiil",
              "task_type": "read",
              "target_ref": "kanunlar/tbk",
              "tip": "kusurun 3 unsurunu listele"
            }
          ]
        }
      ]
    }
  ]
}`;

export function buildPlanPrompt(
  form: FormInput,
  practiceStats: PracticeStats,
  tickHistory: TickHistory
): string {
  const userInput = {
    form,
    practice_stats: practiceStats,
    tick_history: tickHistory.slice(0, 50), // son 50 tik
  };

  return `${SYSTEM_PROMPT}

KULLANICI INPUT:
${JSON.stringify(userInput, null, 2)}

YANIT (SADECE JSON, başka metin yok):`;
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Expected: çıktı yok.

- [ ] **Step 3: Commit**

```bash
git add worker/src/lib/plan-prompt.ts
git commit -m "feat(worker): plan prompt builder (system + input + schema)"
```

---

## Task 4: Worker D1 store helpers

**Files:**
- Create: `worker/src/lib/plan-store.ts`

- [ ] **Step 1: Write store module**

```typescript
// worker/src/lib/plan-store.ts
import type { FormInput, AiOutput, PracticeStats, TickHistory } from "./plan-schemas";

export type StoredPlan = {
  id: string;
  form_input: FormInput;
  ai_output: AiOutput;
  ai_model: string;
  generated_at: number;
  is_active: number;
};

export type PlanRow = {
  id: string;
  form_input: string;
  ai_output: string;
  ai_model: string;
  generated_at: number;
  is_active: number;
};

function parseRow(row: PlanRow): StoredPlan {
  return {
    id: row.id,
    form_input: JSON.parse(row.form_input) as FormInput,
    ai_output: JSON.parse(row.ai_output) as AiOutput,
    ai_model: row.ai_model,
    generated_at: row.generated_at,
    is_active: row.is_active,
  };
}

export async function getActivePlan(db: D1Database): Promise<StoredPlan | null> {
  const r = await db
    .prepare(`SELECT * FROM study_plans WHERE is_active = 1 ORDER BY generated_at DESC LIMIT 1`)
    .first<PlanRow>();
  return r ? parseRow(r) : null;
}

export async function getPlanById(
  db: D1Database,
  id: string
): Promise<StoredPlan | null> {
  const r = await db
    .prepare(`SELECT * FROM study_plans WHERE id = ?`)
    .bind(id)
    .first<PlanRow>();
  return r ? parseRow(r) : null;
}

export async function insertPlan(
  db: D1Database,
  args: {
    id: string;
    form_input: FormInput;
    ai_output: AiOutput;
    ai_model: string;
  }
): Promise<void> {
  // Yeni plan eklenirken eskiler arşivleniyor
  await db.batch([
    db.prepare(`UPDATE study_plans SET is_active = 0`),
    db.prepare(
      `INSERT INTO study_plans (id, form_input, ai_output, ai_model, generated_at, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`
    ).bind(
      args.id,
      JSON.stringify(args.form_input),
      JSON.stringify(args.ai_output),
      args.ai_model,
      Date.now()
    ),
  ]);
}

export async function fetchPracticeStats(db: D1Database): Promise<PracticeStats> {
  // practice_responses tablosundan course bazlı average + count
  const rows = await db
    .prepare(
      `SELECT
         json_extract(case_id, '$') as case_id,
         AVG(score) as avg_score,
         COUNT(*) as case_count
       FROM practice_responses
       GROUP BY case_id`
    )
    .all<{ case_id: string; avg_score: number; case_count: number }>();
  // case_id format: "borc_001" → course = "borclar_ozel" gibi
  // Pratik: case_id prefix → course mapping (manual yapay; veya sadece prefix kullan)
  const byCourse = new Map<string, { sum: number; n: number }>();
  for (const r of rows.results) {
    const prefix = r.case_id.split("_")[0];
    const cur = byCourse.get(prefix) ?? { sum: 0, n: 0 };
    cur.sum += r.avg_score * r.case_count;
    cur.n += r.case_count;
    byCourse.set(prefix, cur);
  }
  const PREFIX_TO_COURSE: Record<string, string> = {
    borc: "borclar_ozel",
    borcg: "borclar_genel",
    miras: "miras_hukuku",
    esya: "esya_hukuku",
    is: "is_hukuku",
    vergi: "vergi_hukuku",
    ticaret: "ticaret_hukuku",
    kev: "kiymetli_evrak",
    deniz: "deniz_ticareti",
    musul: "medeni_usul",
    icra: "icra_iflas",
    cezag: "ceza_genel",
    cezao: "ceza_ozel",
    cezam: "ceza_muhakemesi",
    idy: "idari_yargilama",
    mlk: "milletlerarasi_kamu",
    mohuk: "milletlerarasi_ozel",
  };
  const out: PracticeStats = [];
  for (const [prefix, { sum, n }] of byCourse.entries()) {
    const course = PREFIX_TO_COURSE[prefix] ?? prefix;
    out.push({
      course,
      avg_score: Math.round(sum / Math.max(n, 1)),
      case_count: n,
    });
  }
  return out;
}

export async function fetchTickHistory(
  db: D1Database,
  planId: string
): Promise<TickHistory> {
  const rows = await db
    .prepare(
      `SELECT task_uuid, completed_at FROM study_task_completions WHERE plan_id = ? ORDER BY completed_at DESC LIMIT 50`
    )
    .bind(planId)
    .all<{ task_uuid: string; completed_at: number }>();
  // course bilgisini plan ai_output'tan çekmek gerek, ama burada plan_id'den çekiliyor
  // Basitlik için course'u kaldırıyoruz; sadece task_uuid + completed_at döner.
  // AI prompt için ham veri yeterli — course tahmin gerekiyorsa ileride parse edilir.
  return rows.results.map((r) => ({
    task_uuid: r.task_uuid,
    course: "",
    completed_at: r.completed_at,
  }));
}

export async function setCompletion(
  db: D1Database,
  args: { task_uuid: string; plan_id: string; completed: boolean }
): Promise<void> {
  if (args.completed) {
    await db
      .prepare(
        `INSERT OR REPLACE INTO study_task_completions (task_uuid, plan_id, completed_at)
         VALUES (?, ?, ?)`
      )
      .bind(args.task_uuid, args.plan_id, Date.now())
      .run();
  } else {
    await db
      .prepare(`DELETE FROM study_task_completions WHERE task_uuid = ?`)
      .bind(args.task_uuid)
      .run();
  }
}

export async function fetchCompletions(
  db: D1Database,
  planId: string
): Promise<Record<string, number>> {
  const rows = await db
    .prepare(
      `SELECT task_uuid, completed_at FROM study_task_completions WHERE plan_id = ?`
    )
    .bind(planId)
    .all<{ task_uuid: string; completed_at: number }>();
  const map: Record<string, number> = {};
  for (const r of rows.results) map[r.task_uuid] = r.completed_at;
  return map;
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Expected: çıktı yok.

- [ ] **Step 3: Commit**

```bash
git add worker/src/lib/plan-store.ts
git commit -m "feat(worker): plan-store (D1 query helpers — plans + completions + stats)"
```

---

## Task 5: Worker plan routes

**Files:**
- Create: `worker/src/routes/plan.ts`
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Write route module**

```typescript
// worker/src/routes/plan.ts
import { Hono } from "hono";
import {
  FormInputSchema,
  AiOutputSchema,
  type AiOutput,
} from "../lib/plan-schemas";
import { buildPlanPrompt } from "../lib/plan-prompt";
import {
  getActivePlan,
  insertPlan,
  fetchPracticeStats,
  fetchTickHistory,
  setCompletion,
  fetchCompletions,
} from "../lib/plan-store";
import { GeminiProvider } from "../lib/ai-provider";
// NOT: ai-provider.ts'te şu an DeepSeek default — class adı GeminiProvider olarak kalmış
// olabilir (history nedeniyle). Eğer yeniden adlandırıldıysa import'u güncelle.

type Bindings = {
  DB: D1Database;
  GEMINI_KEY: string;
};

export const plan = new Hono<{ Bindings: Bindings }>();

const MODEL_ID = "deepseek-v4-flash";

plan.post("/generate", async (c) => {
  let body: { form: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const formParsed = FormInputSchema.safeParse(body.form);
  if (!formParsed.success) {
    return c.json(
      { error: "form validation failed", details: formParsed.error.format() },
      400
    );
  }
  const form = formParsed.data;

  // 1) practice_stats
  const practiceStats = await fetchPracticeStats(c.env.DB);

  // 2) eski plan varsa tick history
  const existing = await getActivePlan(c.env.DB);
  const tickHistory = existing
    ? await fetchTickHistory(c.env.DB, existing.id)
    : [];

  // 3) prompt
  const prompt = buildPlanPrompt(form, practiceStats, tickHistory);

  // 4) AI call
  const provider = new GeminiProvider(c.env.GEMINI_KEY);
  let raw = "";
  for await (const tok of provider.streamChat(prompt)) raw += tok;

  // 5) JSON cleanup + parse
  raw = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: AiOutput;
  try {
    const j = JSON.parse(raw);
    const v = AiOutputSchema.safeParse(j);
    if (!v.success) {
      return c.json(
        { error: "AI output schema invalid", details: v.error.format(), raw: raw.slice(0, 500) },
        502
      );
    }
    parsed = v.data;
  } catch (e) {
    return c.json(
      { error: "AI output not JSON", raw: raw.slice(0, 500) },
      502
    );
  }

  // 6) insert plan
  const id = crypto.randomUUID();
  await insertPlan(c.env.DB, {
    id,
    form_input: form,
    ai_output: parsed,
    ai_model: MODEL_ID,
  });

  return c.json({ plan_id: id, ai_output: parsed, summary: parsed.summary });
});

plan.post("/task-toggle", async (c) => {
  let body: { task_uuid?: string; completed?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }
  if (!body.task_uuid || typeof body.completed !== "boolean") {
    return c.json({ error: "task_uuid (string) + completed (bool) required" }, 400);
  }

  const active = await getActivePlan(c.env.DB);
  if (!active) return c.json({ error: "no active plan" }, 404);

  await setCompletion(c.env.DB, {
    task_uuid: body.task_uuid,
    plan_id: active.id,
    completed: body.completed,
  });

  return c.json({ ok: true });
});

plan.get("/active", async (c) => {
  const active = await getActivePlan(c.env.DB);
  if (!active) return c.json({ plan: null, completions: {} });

  const completions = await fetchCompletions(c.env.DB, active.id);
  return c.json({ plan: active, completions });
});
```

- [ ] **Step 2: Mount route in worker/src/index.ts**

`worker/src/index.ts`'i aç, mevcut `app.route("/ai", ai)` satırının altına ekle:

```typescript
import { plan } from "./routes/plan";
// ...
app.route("/plan", plan);
// /ai/plan-generate için ai router'ında değil, /plan/generate olarak mount ettik.
// Eğer kullanıcı /ai/plan-generate path'inde ısrar ederse, ek olarak ai router'ında da mount edilebilir.
```

Pratik: spec'te `POST /ai/plan-generate` denmişti — kullanıcı tutarlılık için `/plan/generate` olarak da kabul ederse path bu olur. Frontend de buna göre.

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: çıktı yok.

- [ ] **Step 4: Deploy worker**

```bash
npx wrangler deploy 2>&1 | tail -10
```

Expected: "Deployed hukuk-worker triggers" satırı.

- [ ] **Step 5: Smoke test active endpoint**

```bash
curl -s https://hukuk-worker.efearas06.workers.dev/plan/active | head -c 200
```

Expected: `{"plan":null,"completions":{}}`

- [ ] **Step 6: Smoke test generate (gerçek AI çağrısı — 30-45 sn sürer)**

```bash
curl -s -X POST https://hukuk-worker.efearas06.workers.dev/plan/generate \
  -H "Content-Type: application/json" \
  -d '{
    "form": {
      "target_exam": "final",
      "exam_date": "2026-06-30",
      "weeks_remaining": 5,
      "weekly_hours_weekday": 4,
      "weekly_hours_weekend": 8,
      "study_window_start": "09:00",
      "study_window_end": "18:00",
      "weak_courses": ["borclar_genel"],
      "notes": "test"
    }
  }' | head -c 500
```

Expected: `{"plan_id":"<uuid>","ai_output":{"summary":"...","weeks":[...]},...}`. Eğer 502 ise raw cevap gelir — AI prompt veya parser sorunu, retry et.

- [ ] **Step 7: Commit + deploy ref**

```bash
git add worker/src/routes/plan.ts worker/src/index.ts
git commit -m "feat(worker): /plan/{generate,task-toggle,active} endpoints"
```

---

## Task 6: Frontend types + API client

**Files:**
- Create: `frontend/types/plan.ts`
- Create: `frontend/lib/plan-api.ts`

- [ ] **Step 1: Write types module**

```typescript
// frontend/types/plan.ts
// Worker plan-schemas.ts ile birebir senkron — değiştirirsen iki yeri de güncelle.

export type FormInput = {
  target_exam: "final" | "hmgs" | "both";
  exam_date: string;
  weeks_remaining: number;
  weekly_hours_weekday: number;
  weekly_hours_weekend: number;
  study_window_start: string;
  study_window_end: string;
  weak_courses: string[];
  notes: string;
};

export type Task = {
  uuid: string;
  time_start: string;
  time_end: string;
  course: string;
  topic: string;
  task_type: "read" | "practice" | "review";
  target_ref?: string;
  tip?: string;
};

export type Day = {
  date: string;
  weekday: string;
  tasks: Task[];
};

export type Week = {
  week_index: number;
  start_date: string;
  end_date: string;
  days: Day[];
};

export type AiOutput = {
  summary: string;
  weeks: Week[];
};

export type StoredPlan = {
  id: string;
  form_input: FormInput;
  ai_output: AiOutput;
  ai_model: string;
  generated_at: number;
  is_active: number;
};

export type ActivePlanResponse = {
  plan: StoredPlan | null;
  completions: Record<string, number>;
};

export type GenerateResponse = {
  plan_id: string;
  ai_output: AiOutput;
  summary: string;
};
```

- [ ] **Step 2: Write API client**

```typescript
// frontend/lib/plan-api.ts
import type {
  ActivePlanResponse,
  FormInput,
  GenerateResponse,
} from "@/types/plan";

const WORKER_URL =
  process.env.NEXT_PUBLIC_WORKER_URL ??
  "https://hukuk-worker.efearas06.workers.dev";

export async function getActivePlan(): Promise<ActivePlanResponse> {
  const r = await fetch(`${WORKER_URL}/plan/active`, {
    credentials: "include",
  });
  if (!r.ok) throw new Error(`getActivePlan ${r.status}`);
  return (await r.json()) as ActivePlanResponse;
}

export async function generatePlan(form: FormInput): Promise<GenerateResponse> {
  const r = await fetch(`${WORKER_URL}/plan/generate`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ form }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`generatePlan ${r.status}: ${text.slice(0, 200)}`);
  }
  return (await r.json()) as GenerateResponse;
}

export async function toggleTask(
  task_uuid: string,
  completed: boolean
): Promise<void> {
  const r = await fetch(`${WORKER_URL}/plan/task-toggle`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task_uuid, completed }),
  });
  if (!r.ok) throw new Error(`toggleTask ${r.status}`);
}
```

- [ ] **Step 3: Type check frontend**

```bash
cd /Users/efekarakoyun/hukukçalışma/uygulama/frontend
npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
```

Expected: çıktı yok.

- [ ] **Step 4: Commit**

```bash
git add frontend/types/plan.ts frontend/lib/plan-api.ts
git commit -m "feat(frontend): plan types + API client (active/generate/toggle)"
```

---

## Task 7: Setup form sayfası

**Files:**
- Create: `frontend/app/plan/setup/page.tsx`

- [ ] **Step 1: Write form page**

```typescript
// frontend/app/plan/setup/page.tsx
"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { COURSES } from "@/lib/courses";
import { generatePlan } from "@/lib/plan-api";
import type { FormInput } from "@/types/plan";

export default function PlanSetupPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [targetExam, setTargetExam] = useState<FormInput["target_exam"]>("final");
  const [examDate, setExamDate] = useState("2026-06-30");
  const [hoursWeekday, setHoursWeekday] = useState(4);
  const [hoursWeekend, setHoursWeekend] = useState(8);
  const [windowStart, setWindowStart] = useState("09:00");
  const [windowEnd, setWindowEnd] = useState("18:00");
  const [weakCourses, setWeakCourses] = useState<string[]>(["borclar_genel"]);
  const [notes, setNotes] = useState("");

  function toggleWeak(courseId: string) {
    setWeakCourses((prev) =>
      prev.includes(courseId)
        ? prev.filter((x) => x !== courseId)
        : [...prev, courseId]
    );
  }

  function computeWeeksRemaining(): number {
    const exam = new Date(examDate);
    const today = new Date();
    const ms = exam.getTime() - today.getTime();
    return Math.max(1, Math.ceil(ms / (7 * 24 * 60 * 60 * 1000)));
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const form: FormInput = {
        target_exam: targetExam,
        exam_date: examDate,
        weeks_remaining: computeWeeksRemaining(),
        weekly_hours_weekday: hoursWeekday,
        weekly_hours_weekend: hoursWeekend,
        study_window_start: windowStart,
        study_window_end: windowEnd,
        weak_courses: weakCourses,
        notes,
      };
      const r = await generatePlan(form);
      if (r.plan_id) {
        router.push("/plan");
      } else {
        setError("Beklenmedik cevap");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🗓️ Yeni Plan Oluştur</h1>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Ana sayfa
        </Link>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">1) Hedef sınav</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          {(["final", "hmgs", "both"] as const).map((v) => (
            <Button
              key={v}
              variant={targetExam === v ? "default" : "outline"}
              size="sm"
              onClick={() => setTargetExam(v)}
            >
              {v === "final" ? "Final (30 Haz)" : v === "hmgs" ? "HMGS (27 Eyl)" : "İkisi birden"}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">2) Sınav tarihi</CardTitle></CardHeader>
        <CardContent>
          <Input
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Kalan hafta: {computeWeeksRemaining()}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">3) Günlük çalışma süresi</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Hafta içi (saat)</label>
            <Input
              type="number"
              min={0}
              max={12}
              step={0.5}
              value={hoursWeekday}
              onChange={(e) => setHoursWeekday(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Hafta sonu (saat)</label>
            <Input
              type="number"
              min={0}
              max={12}
              step={0.5}
              value={hoursWeekend}
              onChange={(e) => setHoursWeekend(Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">4) Çalışma saat penceren</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Başlangıç</label>
            <Input
              type="time"
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Bitiş</label>
            <Input
              type="time"
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">5) Zayıf dersler</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {COURSES.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={weakCourses.includes(c.id)}
                onChange={() => toggleWeak(c.id)}
              />
              {c.name}
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">6) Notlar (opsiyonel)</CardTitle></CardHeader>
        <CardContent>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Salı akşamı iş var, Cuma sabah doktor randevusu vb."
            className="w-full min-h-[80px] p-2 rounded-md border bg-background text-sm"
          />
        </CardContent>
      </Card>

      {error && (
        <div className="border border-red-500/50 bg-red-500/5 rounded p-3 text-sm text-red-500">
          {error}
        </div>
      )}

      <Button
        onClick={submit}
        disabled={submitting}
        className="w-full"
        size="lg"
      >
        {submitting ? "AI program oluşturuyor (~30 sn)..." : "Programı oluştur"}
      </Button>
    </main>
  );
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
```

Expected: çıktı yok.

- [ ] **Step 3: Lokal dev test (opsiyonel)**

```bash
cd /Users/efekarakoyun/hukukçalışma/uygulama
pnpm dev:frontend &
```

Browser → http://localhost:3000/plan/setup → form görünür mü?

- [ ] **Step 4: Commit**

```bash
git add frontend/app/plan/setup/page.tsx
git commit -m "feat(frontend): /plan/setup form (6 alan + zayıf ders seçimi)"
```

---

## Task 8: PlanGrid + TaskCell komponentleri

**Files:**
- Create: `frontend/components/PlanGrid.tsx`
- Create: `frontend/components/TaskCell.tsx`

- [ ] **Step 1: Write TaskCell**

```typescript
// frontend/components/TaskCell.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { toggleTask } from "@/lib/plan-api";
import type { Task } from "@/types/plan";

type Props = {
  task: Task;
  completed: boolean;
  onToggle: (uuid: string, next: boolean) => void;
};

const TYPE_BADGES: Record<Task["task_type"], { label: string; cls: string }> = {
  read: { label: "📖", cls: "bg-blue-500/10 text-blue-600" },
  practice: { label: "⚖️", cls: "bg-purple-500/10 text-purple-600" },
  review: { label: "🔁", cls: "bg-amber-500/10 text-amber-600" },
};

export function TaskCell({ task, completed, onToggle }: Props) {
  const [pending, setPending] = useState(false);
  const badge = TYPE_BADGES[task.task_type];

  async function handleToggle() {
    setPending(true);
    const next = !completed;
    onToggle(task.uuid, next); // optimistic
    try {
      await toggleTask(task.uuid, next);
    } catch (e) {
      onToggle(task.uuid, !next); // rollback
      console.error("toggle failed:", e);
    } finally {
      setPending(false);
    }
  }

  const targetHref = task.target_ref
    ? task.target_ref.startsWith("kanunlar/")
      ? `/${task.target_ref}`
      : task.target_ref.startsWith("practice/")
        ? `/${task.target_ref.replace("practice/", "practice/")}`
        : `/reader/${task.target_ref.replace(/^reader\//, "")}`
    : null;

  return (
    <div
      className={`border rounded p-2 text-xs space-y-1 ${
        completed ? "bg-green-500/5 border-green-500/30 opacity-70" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={completed}
          onChange={handleToggle}
          disabled={pending}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-muted-foreground">
            <span>{task.time_start}–{task.time_end}</span>
            <span className={`px-1 rounded ${badge.cls}`}>{badge.label}</span>
          </div>
          <div className={completed ? "line-through" : "font-medium"}>
            {task.topic}
          </div>
          {targetHref ? (
            <Link
              href={targetHref}
              className="text-blue-600 hover:underline text-[10px]"
            >
              {task.target_ref}
            </Link>
          ) : null}
          {task.tip && (
            <div className="text-[10px] text-amber-700 italic">
              💡 {task.tip}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write PlanGrid**

```typescript
// frontend/components/PlanGrid.tsx
"use client";

import { useState } from "react";
import { TaskCell } from "./TaskCell";
import type { Week, Day } from "@/types/plan";

type Props = {
  weeks: Week[];
  completions: Record<string, number>;
};

const WEEKDAY_ORDER = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

export function PlanGrid({ weeks, completions: initial }: Props) {
  const [completions, setCompletions] = useState(initial);
  const [activeWeek, setActiveWeek] = useState(0);

  function handleToggle(uuid: string, next: boolean) {
    setCompletions((prev) => {
      const cp = { ...prev };
      if (next) cp[uuid] = Date.now();
      else delete cp[uuid];
      return cp;
    });
  }

  const week = weeks[activeWeek];
  if (!week) return <p className="text-sm text-muted-foreground">Plan boş.</p>;

  // gün sırasını WEEKDAY_ORDER'a göre düzelt
  const daysByOrder: Day[] = WEEKDAY_ORDER.map(
    (wd) => week.days.find((d) => d.weekday === wd) ?? null
  ).filter((x): x is Day => x !== null);

  return (
    <div className="space-y-3">
      {/* Hafta sekmeleri */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {weeks.map((w, i) => (
          <button
            key={w.week_index}
            onClick={() => setActiveWeek(i)}
            className={`px-3 py-1 rounded text-xs whitespace-nowrap ${
              i === activeWeek
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/70"
            }`}
          >
            Hafta {w.week_index}
          </button>
        ))}
      </div>

      {/* Tarih aralığı */}
      <p className="text-xs text-muted-foreground">
        {week.start_date} → {week.end_date}
      </p>

      {/* Masaüstü: 7 sütun, mobil: dikey kartlar */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
        {daysByOrder.map((day) => (
          <div key={day.date} className="border rounded p-2 min-h-[120px]">
            <div className="text-xs font-semibold mb-1.5">
              {day.weekday}
              <span className="text-muted-foreground font-normal ml-1">
                {day.date.slice(5)}
              </span>
            </div>
            <div className="space-y-1.5">
              {day.tasks.length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic">Tatil</p>
              ) : (
                day.tasks.map((t) => (
                  <TaskCell
                    key={t.uuid}
                    task={t}
                    completed={!!completions[t.uuid]}
                    onToggle={handleToggle}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
```

Expected: çıktı yok.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/TaskCell.tsx frontend/components/PlanGrid.tsx
git commit -m "feat(frontend): PlanGrid + TaskCell komponentleri (haftalık ızgara + tikleme)"
```

---

## Task 9: /plan sayfası

**Files:**
- Create: `frontend/app/plan/page.tsx`

- [ ] **Step 1: Write plan page**

```typescript
// frontend/app/plan/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlanGrid } from "@/components/PlanGrid";
import { getActivePlan } from "@/lib/plan-api";
import type { ActivePlanResponse } from "@/types/plan";

export default function PlanPage() {
  const [data, setData] = useState<ActivePlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getActivePlan()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="p-6 text-sm text-muted-foreground">Yükleniyor…</main>
    );
  }
  if (error) {
    return (
      <main className="p-6 text-sm text-red-500">
        Hata: {error}
      </main>
    );
  }
  if (!data?.plan) {
    return (
      <main className="p-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">🗓️ Çalışma Planım</h1>
        <p className="text-sm text-muted-foreground">
          Henüz aktif planın yok. Aşağıdaki düğmeyle ilk planı oluştur.
        </p>
        <Link href="/plan/setup">
          <Button size="lg">Yeni plan oluştur</Button>
        </Link>
      </main>
    );
  }

  const { plan, completions } = data;
  const generatedDate = new Date(plan.generated_at).toLocaleString("tr-TR");

  return (
    <main className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">🗓️ Çalışma Planım</h1>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Ana sayfa
        </Link>
      </div>

      <div className="rounded border bg-muted/30 p-3 text-sm space-y-1">
        <p className="font-medium">{plan.ai_output.summary}</p>
        <p className="text-xs text-muted-foreground">
          Sınav: {plan.form_input.exam_date} · {plan.form_input.weeks_remaining} hafta ·
          Üretildi: {generatedDate} · Model: {plan.ai_model}
        </p>
        <div className="flex gap-2 pt-2">
          <Link href="/plan/setup">
            <Button size="sm" variant="outline">Yeni plan</Button>
          </Link>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              // basit yenileme: setup'a mevcut form_input ile yönlendir
              // (ileride form input'u prefill etmek için query string vs.)
              window.location.href = "/plan/setup";
            }}
          >
            Yenile
          </Button>
        </div>
      </div>

      <PlanGrid weeks={plan.ai_output.weeks} completions={completions} />
    </main>
  );
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
```

Expected: çıktı yok.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/plan/page.tsx
git commit -m "feat(frontend): /plan ana sayfa (özet + PlanGrid + yenile/yeni)"
```

---

## Task 10: TodayCard + ana sayfa entegrasyonu

**Files:**
- Create: `frontend/components/TodayCard.tsx`
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Write TodayCard**

```typescript
// frontend/components/TodayCard.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TaskCell } from "./TaskCell";
import { getActivePlan } from "@/lib/plan-api";
import type { Day } from "@/types/plan";

function todayDateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function TodayCard() {
  const [today, setToday] = useState<Day | null>(null);
  const [completions, setCompletions] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [hasPlan, setHasPlan] = useState(false);

  useEffect(() => {
    getActivePlan()
      .then((r) => {
        if (!r.plan) {
          setHasPlan(false);
          return;
        }
        setHasPlan(true);
        setCompletions(r.completions);
        const todayStr = todayDateStr();
        for (const w of r.plan.ai_output.weeks) {
          for (const d of w.days) {
            if (d.date === todayStr) {
              setToday(d);
              return;
            }
          }
        }
        setToday(null);
      })
      .catch(() => setHasPlan(false))
      .finally(() => setLoading(false));
  }, []);

  function handleToggle(uuid: string, next: boolean) {
    setCompletions((prev) => {
      const cp = { ...prev };
      if (next) cp[uuid] = Date.now();
      else delete cp[uuid];
      return cp;
    });
  }

  if (loading) {
    return (
      <div className="rounded border p-4 text-xs text-muted-foreground">
        Plan yükleniyor…
      </div>
    );
  }

  if (!hasPlan) {
    return (
      <Link
        href="/plan/setup"
        className="block rounded border p-4 bg-muted/40 hover:bg-muted/60 text-sm"
      >
        🗓️ <span className="font-medium">İlk çalışma planını oluştur →</span>
        <p className="text-xs text-muted-foreground mt-1">
          AI sınav dönemine kadar saat-saat takvim üretir.
        </p>
      </Link>
    );
  }

  if (!today || today.tasks.length === 0) {
    return (
      <div className="rounded border p-4 text-sm">
        📅 Bugün için planlı görev yok. (Tatil olabilir.)
        <Link
          href="/plan"
          className="block mt-2 text-xs text-blue-600 hover:underline"
        >
          Programın tamamı →
        </Link>
      </div>
    );
  }

  const done = today.tasks.filter((t) => completions[t.uuid]).length;
  const total = today.tasks.length;

  return (
    <div className="rounded border p-3 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">
          📅 Bugün — {today.weekday}
        </span>
        <span className="text-xs text-muted-foreground">
          ⚡ {done}/{total}
        </span>
      </div>
      <div className="space-y-1.5">
        {today.tasks.map((t) => (
          <TaskCell
            key={t.uuid}
            task={t}
            completed={!!completions[t.uuid]}
            onToggle={handleToggle}
          />
        ))}
      </div>
      <Link
        href="/plan"
        className="block text-xs text-blue-600 hover:underline pt-1"
      >
        Programın tamamı →
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Mevcut `frontend/app/page.tsx`'i oku ve TodayCard ekle**

`frontend/app/page.tsx` dosyasını Read ile açıp şu değişiklikleri uygula:

(a) En üste import ekle:
```typescript
import { TodayCard } from "@/components/TodayCard";
```

(b) Ana içerikte mevcut buton grid'inin üstüne TodayCard yerleştir:
```typescript
<TodayCard />

<div className="grid grid-cols-2 gap-2">
  {/* mevcut 3 buton + 4. buton */}
</div>
```

(c) Mevcut buton grid'ine 4. buton ekle (Kanunlar butonundan sonra):
```typescript
<Link
  href="/plan"
  className={
    buttonVariants({ variant: "outline" }) + " col-span-2"
  }
>
  🗓️ Planım
</Link>
```

(NOT: Mevcut "Kanunlar" da `col-span-2`. İki tane `col-span-2` üst üste = iki buton ayrı ayrı tek satır. İstenen davranış buysa OK. Eğer kompakt istenirse "Kanunlar" ve "Planım" yan yana — `col-span-1` ile, ama bu shadcn button width'i daraltır. MVP'de col-span-2 her ikisi için bırakılır.)

- [ ] **Step 3: Lokal görüntü testi**

```bash
cd /Users/efekarakoyun/hukukçalışma/uygulama
pnpm dev:frontend &
```

http://localhost:3000 → "İlk çalışma planını oluştur →" görünmeli (henüz aktif plan yok).

- [ ] **Step 4: Type check + build**

```bash
cd /Users/efekarakoyun/hukukçalışma/uygulama
pnpm --filter ./frontend build 2>&1 | tail -15
```

Expected: "✓ Compiled successfully" ve build sonu.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/TodayCard.tsx frontend/app/page.tsx
git commit -m "feat(frontend): TodayCard + ana sayfaya 'Planım' butonu"
```

---

## Task 11: Uçtan uca smoke test + production deploy

**Files:** Yok, sadece deploy + manuel test.

- [ ] **Step 1: Worker deploy (eğer Task 5'te yapılmadıysa)**

```bash
cd /Users/efekarakoyun/hukukçalışma/uygulama/worker
npx wrangler deploy 2>&1 | tail -10
```

Expected: "Deployed hukuk-worker triggers" satırı.

- [ ] **Step 2: Vercel production deploy**

```bash
cd /Users/efekarakoyun/hukukçalışma/uygulama/frontend
npx vercel --prod 2>&1 | tail -10
```

Expected: "Deployment ... ready" satırı.

- [ ] **Step 3: Manuel uçtan uca test**

Browser → https://hukuk-efe.vercel.app
- [ ] Ana sayfada "İlk çalışma planını oluştur →" görünür
- [ ] Tıkla → `/plan/setup` formu yüklenir
- [ ] Form doldur (default değerler) → "Programı oluştur" → ~30 sn loading
- [ ] `/plan` sayfası yüklenir, haftalık ızgara görünür, özet metni doğru
- [ ] Ana sayfaya dön → bugün kartı görünür, bugünün görevleri listelenmiş
- [ ] Bir göreve tik at → optimistic UI değişir, sayfa yenile → tik kalıcı
- [ ] Bir görev metnine tıkla (target_ref) → ilgili kanun/case/pdf açılır
- [ ] /plan'da "Yenile" → /plan/setup'a yönlendirir
- [ ] Yeni plan üret → eski "is_active=0" oldu mu kontrol (worker logs veya D1 query)

- [ ] **Step 4: D1 sanity query**

```bash
cd /Users/efekarakoyun/hukukçalışma/uygulama/worker
npx wrangler d1 execute hukuk-db --remote --command "SELECT COUNT(*) as total, SUM(is_active) as active FROM study_plans"
```

Expected: total=N, active=1.

- [ ] **Step 5: Final commit (sadece deploy ile gelen sw.js gibi auto-gen değişiklikler varsa)**

```bash
git status --short
# Eğer sw.js veya manifest değişmişse:
git add frontend/public/
git commit -m "chore: pwa assets post-deploy"
```

- [ ] **Step 6: Spec & plan dosyalarını canlı duruma uyacak şekilde işaretle**

`docs/superpowers/specs/2026-05-25-calisma-program-uretici-design.md` üst satırında:
- Eski: `| **Durum** | Brainstorm onaylandı, writing-plans bekliyor |`
- Yeni: `| **Durum** | ✅ Canlı (Sprint 3 tamamlandı, deploy: <tarih>) |`

```bash
git add docs/superpowers/specs/2026-05-25-calisma-program-uretici-design.md
git commit -m "docs: çalışma programı üreticisi canlı (Sprint 3 done)"
```

---

## Self-Review (Plan Sonrası)

### 1. Spec coverage

| Spec bölümü | Karşılayan task |
|---|---|
| 4. Mimari | Task 5 (worker route) + Task 9 (frontend page) |
| 5. D1 Schema | Task 1 (migration) + Task 4 (store helpers) |
| 6. AI Prompt | Task 3 (prompt builder) |
| 7. UI İskeleti — Ana sayfa kartı | Task 10 (TodayCard + page.tsx mod) |
| 7. UI İskeleti — /plan/setup | Task 7 (form page) |
| 7. UI İskeleti — /plan | Task 8 (PlanGrid) + Task 9 (page) |
| 8. Endpoint'ler — generate/toggle/active | Task 5 (route module) |
| 9. Migration ve deploy sırası | Task 1 (migration) + Task 5 (deploy) + Task 11 (uçtan uca) |
| 10. Açık sorular | Default kararlar koda yansıtıldı (yenile manuel, tek aktif plan, vs.) |
| 11. Başarı kriterleri | Task 11 manuel test checklist'inde kapsandı |

Gap yok.

### 2. Placeholder scan

- "TBD" / "TODO" yok.
- "Add error handling" yok — her yerde gerçek hata akışı kodda var.
- Tüm step'lerde komut + beklenen output veya kod blok mevcut.
- Bir not: Task 5 Step 2'de `ai-provider.ts`'teki class adı "GeminiProvider" olabilir (history) — eğer DeepSeek geçişinde yeniden adlandırıldıysa import güncellenmeli. Bu plan executing sırasında dikkat noktası, gerçek bir placeholder değil.

### 3. Type consistency

- `FormInput` (Task 2 + Task 6): aynı 9 field, birebir.
- `AiOutput` (Task 2 + Task 6): aynı yapı, birebir.
- `task_type` enum: hem worker hem frontend'de `"read" | "practice" | "review"` — tutarlı.
- `target_ref` opsiyonel hem worker hem frontend'de.
- `generatePlan` (Task 6) → `/plan/generate` (Task 5): match.
- `toggleTask` (Task 6) → `/plan/task-toggle` (Task 5): match.

Tutarlı.

---

## Execution Handoff

Plan tamamlandı ve `docs/superpowers/plans/2026-05-25-calisma-program-uretici.md`'ye kaydedildi.

İki execution opsiyonu:

**1. Subagent-Driven (önerilen)** — Her task için ayrı subagent dispatch, aralarda review, hızlı iterasyon.

**2. Inline Execution** — Tasks'ı bu oturumda batch ile çalıştır, checkpoint'lerde review.

Hangi yaklaşımı tercih edersin?
