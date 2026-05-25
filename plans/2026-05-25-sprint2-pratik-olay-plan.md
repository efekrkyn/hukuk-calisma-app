# Sprint 2 — Pratik Olay Çözücü Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Türk hukuk sınavlarının %80'i olay analizi. Kullanıcı bir hukuki senaryo okur, kendi çözümünü yazar, AI değerlendirir:
- ✓ Doğru yakaladığı kavramlar
- ⚠ Eksik kalan noktalar
- ✗ Hatalı yorumlar
- 0-100 puan

**Architecture:**
- Cases statik JSON (`data/practice_cases/{course}.json`) — başlangıçta ben üretiyorum (LLM-generated, Türk hukuk müfredatına uygun)
- Worker `/ai/practice-grade` endpoint: olay + ideal çözüm + kullanıcı çözümünü Gemini'ye verir, yapılandırılmış JSON feedback alır
- Frontend `/practice` (ders/case listesi) + `/practice/[id]` (case sayfası: scenario + textarea + grade button + feedback panel)
- Persist responses to D1 `practice_responses` (history için)

**Tech Stack:** Mevcut (Next.js + Worker + Gemini). Ek yok.

---

## File Structure

```
uygulama/
├── data/practice_cases/
│   ├── borclar_ozel.json           # Task 1 (10 case)
│   ├── miras_hukuku.json           # Task 1
│   ├── esya_hukuku.json            # Task 1
│   ├── is_hukuku.json              # Task 1
│   ├── vergi_hukuku.json           # Task 1
│   ├── ticaret_hukuku.json         # Task 1
│   ├── deniz_ticareti.json         # Task 1
│   └── ... (ileri sprintlerde diğer dersler)
├── worker/src/
│   ├── routes/
│   │   ├── practice.ts             # Task 3 (GET /list, /:id)
│   │   └── ai.ts                   # Task 3 (modify: add /practice-grade)
│   └── lib/
│       └── practice-grader.ts      # Task 3
├── frontend/
│   ├── app/practice/
│   │   ├── page.tsx                # Task 4 (course list)
│   │   └── [id]/page.tsx           # Task 5 (case detail)
│   ├── components/
│   │   ├── PracticeCaseCard.tsx    # Task 4
│   │   └── PracticeGrader.tsx      # Task 5
│   └── lib/api.ts                  # Task 3 (add gradePractice)
└── scripts/
    └── upload-practice-cases.ts    # Task 2 (optional: workers'a yükle)
```

---

## Task 1: Olay Üretimi (10 case × 7 ders = 70 case)

Ben şimdi bu konuşmada her ders için 10 olay üretir, JSON'a yazarım. Türk hukuk müfredatına uygun, finals'ta çıkması muhtemel senaryolar.

**Veri formatı:**
```typescript
type PracticeCase = {
  id: string;              // "borc_001"
  course: string;          // "borclar_ozel"
  title: string;           // kısa başlık, listede gösterilir
  difficulty: "kolay" | "orta" | "zor";
  scenario: string;        // olay metni (~200-500 kelime)
  ideal_solution: string;  // detaylı ideal çözüm (~500-1000 kelime)
  key_points: string[];    // mutlaka değinilmesi gereken kavramlar
  source?: string;         // varsa kaynak (Eren s.412 vb.)
  topics: string[];        // ["haksız fiil", "kusur"]
};
```

**Üretim yöntemi:** Her ders için klasik exam pattern'larından — sebepsiz zenginleşme + haksız fiil farkı (borçlar), saklı pay tenkis (miras), zilyetlik+ayni hak (eşya), iş sözleşmesi feshi (iş), vb.

- [ ] **Step 1:** `data/practice_cases/` klasörünü yarat
- [ ] **Step 2:** Her ders için 10 case JSON dosyası yaz
  - Borçlar Özel (en hacimli)
  - Miras
  - Eşya
  - İş
  - Vergi
  - Ticaret
  - Deniz Ticareti
- [ ] **Step 3:** Validation: her case için key_points >= 3, scenario >= 100 chars
- [ ] **Step 4:** Bundle gitignore çıkar (commit edilsin)

---

## Task 2: Worker — Practice Routes

**Files:**
- Create: `worker/src/routes/practice.ts`
- Modify: `worker/src/index.ts` (mount)
- Decision: cases'i nasıl serve edelim? Üç seçenek:
  - A) Frontend bundle'a göm (import JSON) — en basit
  - B) Worker'da static (KV/Assets) — Worker'dan okur
  - C) D1'e seed et — query'lerle çekilir

**Karar:** A — frontend bundle'a göm. Cases zaten küçük (~50KB toplam). Worker sadece grading yapsın.

> ⚠ Bu Task → "no worker route needed for list/:id" — frontend doğrudan static import eder. Sadece grading endpoint kalır.

- [ ] **Step 1:** Skip practice list route — atla.
- [ ] **Step 2:** Sonraki task'a geç (grading endpoint).

---

## Task 3: Worker — `/ai/practice-grade` Endpoint

**Files:**
- Create: `worker/src/lib/practice-grader.ts`
- Modify: `worker/src/routes/ai.ts` (POST /practice-grade)

- [ ] **Step 1:** Grader interface

`worker/src/lib/practice-grader.ts`:
```ts
import { GeminiProvider } from "./ai-provider";

export type GradeRequest = {
  case_id: string;
  scenario: string;
  ideal_solution: string;
  key_points: string[];
  user_solution: string;
};

export type GradeResponse = {
  score: number;          // 0-100
  feedback: string;       // markdown
  hit_points: string[];   // doğru yakalanan key_points
  missed_points: string[];// eksik kalan
  errors: string[];       // hatalı yorumlamalar
  ideal_solution: string; // revealed after grading
};

export async function gradeSolution(
  apiKey: string,
  req: GradeRequest
): Promise<GradeResponse> {
  const prompt = `Sen Türk hukuk öğretim üyesisin. Öğrencinin pratik olay çözümünü değerlendir.

OLAY:
${req.scenario}

İDEAL ÇÖZÜM:
${req.ideal_solution}

OLAYDA MUTLAKA DEĞİNİLMESİ GEREKEN KAVRAMLAR:
${req.key_points.map((p, i) => `${i + 1}. ${p}`).join("\n")}

ÖĞRENCİNİN ÇÖZÜMÜ:
${req.user_solution}

GÖREV: Aşağıdaki JSON formatında değerlendir (SADECE JSON döndür, başka metin YOK):

{
  "score": <0-100 arası tam sayı>,
  "feedback": "<Markdown formatında öğrenciye geri bildirim. Pozitif başlat, sonra eksikler, sonra hatalı yorumlar, kısa ve net.>",
  "hit_points": [<öğrencinin doğru yakaladığı key_point'ler, tam metin>],
  "missed_points": [<öğrencinin atladığı key_point'ler, tam metin>],
  "errors": [<varsa hatalı yorumladığı hukuki kavramlar veya yanlış sonuçlar>]
}

Sadece JSON. Markdown code fence yok.`;

  const provider = new GeminiProvider(apiKey);
  let raw = "";
  for await (const tok of provider.streamChat(prompt)) raw += tok;

  // Strip code fences if Gemini adds them despite instructions
  raw = raw.replace(/^\\s*\`\`\`(?:json)?\\s*/i, "").replace(/\\s*\`\`\`\\s*$/i, "").trim();

  try {
    const j = JSON.parse(raw);
    return { ...j, ideal_solution: req.ideal_solution };
  } catch {
    // Fallback if parsing fails
    return {
      score: 50,
      feedback: "AI cevabı parse edilemedi. Ham çıktı:\\n\\n" + raw.slice(0, 800),
      hit_points: [],
      missed_points: req.key_points,
      errors: [],
      ideal_solution: req.ideal_solution,
    };
  }
}
```

- [ ] **Step 2:** Add route in `worker/src/routes/ai.ts`

```ts
import { gradeSolution } from "../lib/practice-grader";

ai.post("/practice-grade", async (c) => {
  const body = await c.req.json<{
    case_id: string;
    scenario: string;
    ideal_solution: string;
    key_points: string[];
    user_solution: string;
  }>();

  if (!body.user_solution || body.user_solution.trim().length < 20) {
    return c.json({ error: "çözüm en az 20 karakter olmalı" }, 400);
  }

  const result = await gradeSolution(c.env.GEMINI_KEY, body);

  // Persist to D1
  if (c.env.DB) {
    try {
      await c.env.DB.prepare(
        `INSERT INTO practice_responses (id, case_id, user_solution, ai_feedback, score, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(
          crypto.randomUUID(),
          body.case_id,
          body.user_solution,
          JSON.stringify(result),
          result.score,
          Date.now()
        )
        .run();
    } catch (e) {
      console.error("practice_responses persist:", e);
    }
  }

  return c.json(result);
});
```

- [ ] **Step 3:** Deploy worker, smoke test

```bash
cd worker && npx wrangler deploy
# curl with sample request
```

- [ ] **Step 4:** Add `gradePractice` to frontend api.ts

```ts
export async function gradePractice(req: {
  case_id: string;
  scenario: string;
  ideal_solution: string;
  key_points: string[];
  user_solution: string;
}) {
  return fetchWorker<GradeResponse>("/ai/practice-grade", {
    method: "POST",
    body: JSON.stringify(req),
  });
}
```

- [ ] **Step 5:** Commit

---

## Task 4: Frontend — `/practice` Landing

**Files:**
- Create: `frontend/app/practice/page.tsx`
- Create: `frontend/lib/practice-cases.ts` (loader)

- [ ] **Step 1:** Cases loader (statik import)

`frontend/lib/practice-cases.ts`:
```ts
import borclarOzel from "@/data/practice_cases/borclar_ozel.json";
import mirasHukuku from "@/data/practice_cases/miras_hukuku.json";
import esyaHukuku from "@/data/practice_cases/esya_hukuku.json";
import isHukuku from "@/data/practice_cases/is_hukuku.json";
import vergiHukuku from "@/data/practice_cases/vergi_hukuku.json";
import ticaretHukuku from "@/data/practice_cases/ticaret_hukuku.json";
import denizTicareti from "@/data/practice_cases/deniz_ticareti.json";

export type PracticeCase = {
  id: string;
  course: string;
  title: string;
  difficulty: "kolay" | "orta" | "zor";
  scenario: string;
  ideal_solution: string;
  key_points: string[];
  source?: string;
  topics: string[];
};

const ALL: PracticeCase[] = [
  ...(borclarOzel as PracticeCase[]),
  ...(mirasHukuku as PracticeCase[]),
  ...(esyaHukuku as PracticeCase[]),
  ...(isHukuku as PracticeCase[]),
  ...(vergiHukuku as PracticeCase[]),
  ...(ticaretHukuku as PracticeCase[]),
  ...(denizTicareti as PracticeCase[]),
];

export const allCases = (): PracticeCase[] => ALL;
export const caseById = (id: string) => ALL.find((c) => c.id === id);
export const casesByCourse = (course: string) =>
  ALL.filter((c) => c.course === course);
```

- [ ] **Step 2:** Practice landing page

`frontend/app/practice/page.tsx`:
```tsx
"use client";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { COURSES } from "@/lib/courses";
import { allCases, type PracticeCase } from "@/lib/practice-cases";

export default function PracticeLanding() {
  const cases = allCases();
  const byCourse: Record<string, PracticeCase[]> = {};
  cases.forEach((c) => (byCourse[c.course] ??= []).push(c));

  return (
    <main className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pratik Olaylar</h1>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Ana sayfa
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">
        Olay oku → kendi çözümünü yaz → AI değerlendir + ideal çözüm gör.
      </p>
      {COURSES.map((c) => {
        const list = byCourse[c.id] ?? [];
        if (list.length === 0) return null;
        return (
          <Card key={c.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>{c.name}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {list.length} olay
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {list.map((pc) => (
                <Link
                  key={pc.id}
                  href={`/practice/${pc.id}`}
                  className="block py-2 px-2 -mx-2 rounded hover:bg-muted transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm">{pc.title}</span>
                    <span
                      className={
                        "text-xs px-2 py-0.5 rounded shrink-0 " +
                        (pc.difficulty === "kolay"
                          ? "bg-green-500/15 text-green-600"
                          : pc.difficulty === "orta"
                          ? "bg-yellow-500/15 text-yellow-600"
                          : "bg-red-500/15 text-red-600")
                      }
                    >
                      {pc.difficulty}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {pc.topics.slice(0, 3).join(" · ")}
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </main>
  );
}
```

- [ ] **Step 3:** Ana sayfaya buton ekle (Kitaplara Git'in yanına)

`frontend/app/page.tsx` Button bölümünü güncelle:
```tsx
<div className="grid grid-cols-2 gap-2">
  <Link href="/reader" className={buttonVariants({ variant: "default" })}>
    📖 Kitaplar
  </Link>
  <Link href="/practice" className={buttonVariants({ variant: "outline" })}>
    ⚖️ Pratik Olaylar
  </Link>
</div>
```

- [ ] **Step 4:** Commit

---

## Task 5: Frontend — `/practice/[id]` Detail + Grader

**Files:**
- Create: `frontend/app/practice/[id]/page.tsx`
- Create: `frontend/components/PracticeGrader.tsx`

- [ ] **Step 1:** Detail page (server, route param)

`frontend/app/practice/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { caseById } from "@/lib/practice-cases";
import { PracticeGrader } from "@/components/PracticeGrader";

export default async function PracticeCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pc = caseById(id);
  if (!pc) notFound();
  return <PracticeGrader case_={pc} />;
}
```

- [ ] **Step 2:** Grader component

`frontend/components/PracticeGrader.tsx`:
```tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { gradePractice, type GradeResponse } from "@/lib/api";
import type { PracticeCase } from "@/lib/practice-cases";

export function PracticeGrader({ case_: pc }: { case_: PracticeCase }) {
  const [solution, setSolution] = useState("");
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<GradeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (solution.trim().length < 20) {
      setError("Çözümün en az 20 karakter olmalı.");
      return;
    }
    setError(null);
    setGrading(true);
    try {
      const r = await gradePractice({
        case_id: pc.id,
        scenario: pc.scenario,
        ideal_solution: pc.ideal_solution,
        key_points: pc.key_points,
        user_solution: solution,
      });
      setResult(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setGrading(false);
    }
  }

  function tryAgain() {
    setResult(null);
    setSolution("");
    setError(null);
  }

  const scoreColor =
    result && result.score >= 80
      ? "text-green-500"
      : result && result.score >= 60
      ? "text-yellow-500"
      : "text-red-500";

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/practice"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Pratikler
        </Link>
        <span
          className={
            "text-xs px-2 py-0.5 rounded " +
            (pc.difficulty === "kolay"
              ? "bg-green-500/15 text-green-600"
              : pc.difficulty === "orta"
              ? "bg-yellow-500/15 text-yellow-600"
              : "bg-red-500/15 text-red-600")
          }
        >
          {pc.difficulty}
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{pc.title}</CardTitle>
          <div className="text-xs text-muted-foreground">
            {pc.topics.join(" · ")}
            {pc.source ? ` · ${pc.source}` : ""}
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap">
            {pc.scenario}
          </div>
        </CardContent>
      </Card>

      {!result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Senin Çözümün</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              placeholder="Olayı analiz et, ilgili kavramları belirle, hukuki sonucu yaz..."
              disabled={grading}
              className="w-full min-h-[200px] p-3 rounded border bg-background text-sm font-mono"
            />
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <Button onClick={submit} disabled={grading} className="w-full">
              {grading ? "Değerlendiriliyor..." : "Değerlendir"}
            </Button>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Sonuç</span>
                <span className={"text-2xl font-bold " + scoreColor}>
                  {result.score}/100
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="whitespace-pre-wrap">{result.feedback}</div>

              {result.hit_points.length > 0 && (
                <div>
                  <h3 className="font-semibold text-green-600 mb-1">
                    ✓ Yakaladığın
                  </h3>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {result.hit_points.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.missed_points.length > 0 && (
                <div>
                  <h3 className="font-semibold text-yellow-600 mb-1">
                    ⚠ Atladığın
                  </h3>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {result.missed_points.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.errors.length > 0 && (
                <div>
                  <h3 className="font-semibold text-red-500 mb-1">
                    ✗ Hatalı Yorumlar
                  </h3>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {result.errors.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">İdeal Çözüm</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">
                {result.ideal_solution}
              </div>
            </CardContent>
          </Card>

          <Button onClick={tryAgain} variant="outline" className="w-full">
            Tekrar Dene
          </Button>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 3:** Update `frontend/lib/api.ts` — `gradePractice` + `GradeResponse` type

```ts
export type GradeResponse = {
  score: number;
  feedback: string;
  hit_points: string[];
  missed_points: string[];
  errors: string[];
  ideal_solution: string;
};

export async function gradePractice(req: {
  case_id: string;
  scenario: string;
  ideal_solution: string;
  key_points: string[];
  user_solution: string;
}): Promise<GradeResponse> {
  return fetchWorker<GradeResponse>("/ai/practice-grade", {
    method: "POST",
    body: JSON.stringify(req),
  });
}
```

- [ ] **Step 4:** Build + vercel --prod
- [ ] **Step 5:** Commit + tag sprint-2-done

---

## Verification

- [ ] `/practice` → 7 ders × 10 case görünür
- [ ] Bir case'e tıkla → senaryoyu oku → textarea'ya çözüm yaz → "Değerlendir" → 5-10 saniyede skor + feedback + ideal çözüm
- [ ] Geri dön → başka case dene
- [ ] D1'de `practice_responses` doluyor (`wrangler d1 execute hukuk-db --remote --command "SELECT COUNT(*) FROM practice_responses"`)
- [ ] Production URL'de çalışıyor (telefondan da)

---

## Risk Notları

- **Gemini JSON parse fail:** Bazen markdown fence ekler veya escaped char hatası. Fallback ile graceful — skor 50 + raw output gösterilir.
- **Case kalitesi:** İlk 70 case ben üretiyorum — finals'tan önce kullanıcı 5-10 case çözdükten sonra "şu konuda eksik" deyip ben yeni case'ler eklerim.
- **Veri kaybı:** Cases statik JSON, repo'da. JSONL embed cache gibi gitignored DEĞİL.
- **Daily Gemini quota:** Free tier 1500 req/gün. Pratik grading her çözüm = 1 req. 1500/gün >> 30/gün tipik kullanım.

## Sonraki

Sprint 3 (Flashcard SRS) - finals haftası ezber pekiştirme. Sonra Sprint 4 (Quiz Engine - HMGS odaklı).
