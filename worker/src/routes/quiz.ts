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
  const body = await c.req.json<{
    course: string;
    topic: string;
    question_id: string;
    selected_answer: number;
    is_correct: number;
  }>();

  if (!body.course || !body.question_id || body.selected_answer === undefined || body.is_correct === undefined) {
    return c.json({ error: "Missing required fields" }, 400);
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
