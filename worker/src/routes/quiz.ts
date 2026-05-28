import { Hono } from "hono";

type Bindings = {
  DB: D1Database;
};

const quizRouter = new Hono<{ Bindings: Bindings }>();

// GET /quiz/stats?course=XYZ
quizRouter.get("/stats", async (c) => {
  const course = c.req.query("course");
  if (!course) {
    return c.json({ error: "Missing course param" }, 400);
  }

  // Calculate overall stats
  const statsQuery = await c.env.DB.prepare(
    "SELECT COUNT(*) as total_attempts, SUM(is_correct) as correct_count FROM quiz_attempts WHERE course = ?"
  )
    .bind(course)
    .first<{ total_attempts: number; correct_count: number }>();

  // Calculate weak topics (topics with < 60% accuracy or just sort by accuracy)
  const topicsQuery = await c.env.DB.prepare(
    `SELECT topic, COUNT(*) as attempts, SUM(is_correct) as correct 
     FROM quiz_attempts 
     WHERE course = ? AND topic IS NOT NULL
     GROUP BY topic
     HAVING attempts > 0`
  )
    .bind(course)
    .all<{ topic: string; attempts: number; correct: number }>();

  const weakTopics = topicsQuery.results
    .map(t => ({
      topic: t.topic,
      accuracy: t.correct / t.attempts
    }))
    .filter(t => t.accuracy < 0.6)
    .sort((a, b) => a.accuracy - b.accuracy)
    .map(t => t.topic);

  return c.json({
    total_attempts: statsQuery?.total_attempts || 0,
    correct_count: statsQuery?.correct_count || 0,
    weakTopics: weakTopics
  });
});

// POST /quiz/submit
quizRouter.post("/submit", async (c) => {
  let body: {
    course: string;
    topic: string;
    question_id: string;
    selected_answer: number;
    is_correct: number;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  if (!body.course || typeof body.course !== "string") {
    return c.json({ error: "course (string) required" }, 400);
  }
  if (!body.question_id || typeof body.question_id !== "string") {
    return c.json({ error: "question_id (string) required" }, 400);
  }
  if (typeof body.selected_answer !== "number" || !Number.isInteger(body.selected_answer)) {
    return c.json({ error: "selected_answer (integer) required" }, 400);
  }
  if (typeof body.is_correct !== "number" || (body.is_correct !== 0 && body.is_correct !== 1)) {
    return c.json({ error: "is_correct must be 0 or 1" }, 400);
  }

  const id = crypto.randomUUID();
  const created_at = Date.now();

  await c.env.DB.prepare(
    `INSERT INTO quiz_attempts (id, course, topic, question_id, selected_answer, is_correct, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, body.course, body.topic || null, body.question_id, body.selected_answer, body.is_correct, created_at)
    .run();

  return c.json({ success: true, id });
});

export { quizRouter };
