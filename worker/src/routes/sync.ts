import { Hono } from "hono";

type Bindings = { DB?: D1Database };

export const sync = new Hono<{ Bindings: Bindings }>();

sync.get("/status", async (c) => {
  if (!c.env.DB) {
    return c.json(
      {
        status: "d1_not_bound",
        message:
          "D1 binding not yet configured. Run `wrangler d1 create hukuk-db`, paste id into wrangler.toml, and apply schema.sql.",
      },
      503
    );
  }
  const tables = [
    "quiz_attempts",
    "flashcard_state",
    "chat_history",
    "study_plan",
    "pomodoro_sessions",
    "practice_responses",
  ];
  const counts: Record<string, number> = {};
  for (const t of tables) {
    try {
      const r = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first<{
        n: number;
      }>();
      counts[t] = r?.n ?? -1;
    } catch {
      counts[t] = -1; // table not yet created
    }
  }
  return c.json({ status: "ok", counts, ts: new Date().toISOString() });
});
