import { Hono } from "hono";
import {
  FormInputSchema,
  AiOutputSchema,
  TaskSchema,
  type AiOutput,
} from "../lib/plan-schemas";
import {
  buildPlanPrompt,
  buildDays,
  buildOutlook,
  daysBetween,
  istanbulToday,
  subjectShares,
  PLAN_WEEKS,
} from "../lib/plan-prompt";
import { sanitizePlan, canonicalTask } from "../lib/plan-validate";
import {
  getActivePlan,
  insertPlan,
  fetchStudyStats,
  fetchPlanProgress,
  setCompletion,
  fetchCompletions,
} from "../lib/plan-store";
import { parseLlmJson } from "../lib/llm-json";
import { DeepSeekProvider } from "../lib/ai-provider";

type Bindings = {
  DB: D1Database;
  GEMINI_KEY: string;
  DEEPSEEK_API_KEY?: string;
};

/**
 * İsteğin sahibi — index.ts'teki kimlik middleware'i yazıyor.
 *
 * Bu dosyadaki DÖRT uç da kullanıcıya ait: program kişinin sınav tarihine,
 * müsait günlerine ve kendi zayıf alanlarına göre üretiliyor. Paylaşılan
 * hiçbir şey yok — plan-store.ts'teki her fonksiyon bu yüzden userId istiyor.
 */
type Variables = {
  userId: string;
};

export const plan = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/** Üretim modeli — projenin geri kalanıyla aynı (denetim tarafı reasoner). */
const MODEL_ID = "deepseek-chat";

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

  const today = istanbulToday();
  const daysLeft = daysBetween(today, form.exam_date);
  if (daysLeft < 1) {
    return c.json({ error: "sınav tarihi bugünden sonra olmalı" }, 400);
  }

  const userId = c.get("userId");
  const stats = await fetchStudyStats(c.env.DB, userId);

  const existing = await getActivePlan(c.env.DB, userId);
  const previous = existing ? await fetchPlanProgress(c.env.DB, userId, existing) : null;

  // Sınav uzaksa bile plan penceresi PLAN_WEEKS ile sınırlı; kalan süre daha
  // kısaysa takvim sınav gününde biter.
  const weeks = Math.min(PLAN_WEEKS, Math.ceil(daysLeft / 7));
  const days = buildDays(today, weeks, form.days_off).filter(
    (d) => d.date <= form.exam_date
  );

  const prompt = buildPlanPrompt({ form, stats, today, days, previous });

  const apiKey = c.env.DEEPSEEK_API_KEY ?? c.env.GEMINI_KEY;
  const provider = new DeepSeekProvider(apiKey ?? "", MODEL_ID);
  let raw = "";
  for await (const tok of provider.streamChat(prompt)) raw += tok;

  const json = parseLlmJson<unknown>(raw);
  if (json === null) {
    // Ham çıktı LOG'a gidiyor, kullanıcıya DEĞİL: ekrana 2000 karakterlik
    // yarım JSON basmak kullanıcıya hiçbir şey anlatmıyordu.
    console.error("plan/generate ayrıştırılamadı, uzunluk:", raw.length, raw.slice(0, 500));
    // Yarıda kesilmiş çıktı ile bozuk çıktı farklı sorunlar: ilki tekrar
    // denemekle geçebilir, ikincisi geçmez. Ayırt edilebiliyorsa söylensin.
    const kesik = raw.trimStart().startsWith("{") && !raw.trimEnd().endsWith("}");
    return c.json(
      {
        error: kesik
          ? "Plan üretilemedi: model çıktısı yarıda kesildi."
          : "Plan üretilemedi: model geçerli bir plan döndürmedi.",
        detail: "Tekrar dene; sürerse günlük saat sayısını biraz düşür.",
      },
      502
    );
  }

  const v = AiOutputSchema.safeParse(json);
  if (!v.success) {
    console.error("plan/generate şema hatası:", JSON.stringify(v.error.format()).slice(0, 800));
    return c.json(
      {
        error: "Plan üretilemedi: model beklenen biçimde plan döndürmedi.",
        detail: "Tekrar dene.",
      },
      502
    );
  }

  // Hedefler kaydedilmeden önce HMGS_SUBJECTS'e karşı doğrulanır; tıklanınca
  // 404 veren bir plan hiç plan olmamasından kötüdür.
  const clean = sanitizePlan(v.data);
  const remaining = clean.output.weeks.reduce(
    (a, w) => a + w.days.reduce((b, d) => b + d.tasks.length, 0),
    0
  );
  if (remaining === 0) {
    return c.json(
      { error: "planın tüm görevleri geçersiz hedef taşıyordu", dropped: clean.dropped },
      502
    );
  }

  // Ayrıntılı plan 2 haftayla sınırlı (modelin çıktı sınırı daha uzununu
  // JSON'un ortasında kesiyordu). Kalan haftalar için kaba bakış KODDA
  // üretiliyor: saat dağıtımı zaten subjectShares ile hesaplanmış durumda,
  // aynı hesabı modele tekrarlatmak token harcar ve iki farklı sayı üretme
  // riski taşır.
  const outlook = buildOutlook({
    today,
    examDate: form.exam_date,
    detailedWeeks: weeks,
    dailyHours: form.daily_hours,
    daysOff: form.days_off,
    shares: subjectShares(stats),
  });

  const cikti = { ...clean.output, outlook };

  const id = crypto.randomUUID();
  await insertPlan(c.env.DB, {
    id,
    userId,
    form_input: form,
    ai_output: cikti,
    ai_model: MODEL_ID,
  });

  return c.json({
    plan_id: id,
    ai_output: cikti,
    summary: clean.output.summary,
    dropped: clean.dropped,
    repaired: clean.repaired,
  });
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

  const userId = c.get("userId");
  const active = await getActivePlan(c.env.DB, userId);
  if (!active) return c.json({ error: "no active plan" }, 404);

  await setCompletion(c.env.DB, {
    task_uuid: body.task_uuid,
    plan_id: active.id,
    user_id: userId,
    completed: body.completed,
  });

  return c.json({ ok: true });
});

plan.post("/add-task", async (c) => {
  let body: { date?: string; task?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }
  if (!body.date) return c.json({ error: "date required" }, 400);

  // Elle eklenen görev de aynı kapıdan geçiyor: şema + hedef doğrulaması.
  // Aksi hâlde plana AI'ın yazamayacağı bir hedef elle sokulabilirdi.
  const taskParsed = TaskSchema.safeParse(body.task);
  if (!taskParsed.success) {
    return c.json({ error: "task validation failed", details: taskParsed.error.format() }, 400);
  }
  const task = canonicalTask(taskParsed.data);
  if (!task) return c.json({ error: "görevin alanı HMGS alanlarından biri değil" }, 400);

  const userId = c.get("userId");
  const active = await getActivePlan(c.env.DB, userId);
  if (!active) return c.json({ error: "no active plan" }, 404);

  const planData: AiOutput = active.ai_output;
  let dayFound = false;

  for (const week of planData.weeks) {
    const day = week.days.find((d) => d.date === body.date);
    if (day) {
      day.tasks.push(task);
      day.tasks.sort((a, b) => a.time_start.localeCompare(b.time_start));
      dayFound = true;
      break;
    }
  }

  if (!dayFound) {
    // Gün planda yoksa doğru haftaya ekle
    for (const week of planData.weeks) {
      if (body.date >= week.start_date && body.date <= week.end_date) {
        week.days.push({
          date: body.date,
          weekday: new Date(body.date).toLocaleDateString("tr-TR", { weekday: "long" }),
          tasks: [task],
        });
        week.days.sort((a, b) => a.date.localeCompare(b.date));
        dayFound = true;
        break;
      }
    }
  }

  if (!dayFound) {
    return c.json({ error: "Date is out of bounds of the current plan weeks." }, 400);
  }

  try {
    // user_id ölçütte: plan zaten bu kullanıcının aktif planı ama yazma
    // sorgusunun sahiplik kontrolü kendi WHERE'inde olmalı, okumadan
    // devralınan bir varsayımda değil.
    await c.env.DB.prepare(
      `UPDATE study_plans SET ai_output = ? WHERE id = ? AND user_id = ?`
    )
      .bind(JSON.stringify(planData), active.id, userId)
      .run();
  } catch (e) {
    console.error("Failed to update plan:", e);
    return c.json({ error: "DB update failed" }, 500);
  }

  return c.json({ ok: true, plan: planData });
});

plan.get("/active", async (c) => {
  const userId = c.get("userId");
  const active = await getActivePlan(c.env.DB, userId);
  if (!active) return c.json({ plan: null, completions: {} });

  const completions = await fetchCompletions(c.env.DB, userId, active.id);
  return c.json({ plan: active, completions });
});
