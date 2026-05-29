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
import { DeepSeekProvider } from "../lib/ai-provider";

type Bindings = {
  DB: D1Database;
  GEMINI_KEY: string;
  DEEPSEEK_API_KEY?: string;
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
  const apiKey = c.env.DEEPSEEK_API_KEY ?? c.env.GEMINI_KEY;
  const provider = new DeepSeekProvider(apiKey ?? "", MODEL_ID);
  let raw = "";
  for await (const tok of provider.streamChat(prompt)) raw += tok;

  // 5) JSON cleanup + parse
  const thinkEnd = raw.lastIndexOf("</think>");
  if (thinkEnd !== -1) {
    raw = raw.slice(thinkEnd + 8).trim();
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
    raw = raw.slice(firstBrace, lastBrace + 1);
  } else {
    raw = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
  }

  let parsed: AiOutput;
  try {
    const j = JSON.parse(raw);
    const v = AiOutputSchema.safeParse(j);
    if (!v.success) {
      return c.json(
        { error: "AI output schema invalid", details: v.error.format(), raw: raw },
        502
      );
    }
    parsed = v.data;
  } catch (e) {
    return c.json(
      { error: "AI output not JSON", raw: raw },
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

plan.post("/add-task", async (c) => {
  let body: { date: string; task: any };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }
  if (!body.date || !body.task || !body.task.uuid) {
    return c.json({ error: "date and task object with uuid required" }, 400);
  }

  const active = await getActivePlan(c.env.DB);
  if (!active) return c.json({ error: "no active plan" }, 404);

  const planData = active.ai_output;
  let dayFound = false;

  for (const week of planData.weeks) {
    let day = week.days.find((d: any) => d.date === body.date);
    if (day) {
      day.tasks.push(body.task);
      day.tasks.sort((a: any, b: any) => a.time_start.localeCompare(b.time_start));
      dayFound = true;
      break;
    }
  }

  if (!dayFound) {
    // If the day doesn't exist, we find the right week and insert the day
    for (const week of planData.weeks) {
      if (body.date >= week.start_date && body.date <= week.end_date) {
        week.days.push({
          date: body.date,
          weekday: new Date(body.date).toLocaleDateString("tr-TR", { weekday: "long" }),
          tasks: [body.task]
        });
        week.days.sort((a: any, b: any) => a.date.localeCompare(b.date));
        dayFound = true;
        break;
      }
    }
  }

  if (!dayFound) {
    return c.json({ error: "Date is out of bounds of the current plan weeks." }, 400);
  }

  try {
    await c.env.DB.prepare(
      `UPDATE study_plans SET ai_output = ? WHERE id = ?`
    ).bind(
      JSON.stringify(planData),
      active.id
    ).run();
  } catch (e) {
    console.error("Failed to update plan:", e);
    return c.json({ error: "DB update failed" }, 500);
  }

  return c.json({ ok: true, plan: planData });
});

plan.get("/active", async (c) => {
  const active = await getActivePlan(c.env.DB);
  if (!active) return c.json({ plan: null, completions: {} });

  const completions = await fetchCompletions(c.env.DB, active.id);
  return c.json({ plan: active, completions });
});
