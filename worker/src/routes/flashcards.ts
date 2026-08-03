import { Hono } from "hono";
import { schedule, type StoredSrs } from "../lib/srs";

type Bindings = {
  DB: D1Database;
};

export const flashcardsRouter = new Hono<{ Bindings: Bindings }>();

interface FlashcardState {
  card_id: string;
  course: string;
  ease: number;
  interval_days: number;
  next_review: number;
  last_seen: number | null;
  streak: number;
}

// GET /flashcards/state?course=X
flashcardsRouter.get("/state", async (c) => {
  const course = c.req.query("course");
  if (!course) {
    return c.json({ error: "course parameter is required" }, 400);
  }

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM flashcard_state WHERE course = ?"
  )
    .bind(course)
    .all<FlashcardState>();

  return c.json({ state: results || [] });
});

// POST /flashcards/review
flashcardsRouter.post("/review", async (c) => {
  let body: {
    card_id: string;
    course: string;
    grade: number; // 0=Tekrar 1=Zor 2=İyi 3=Kolay
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  if (!body.card_id || typeof body.card_id !== "string") {
    return c.json({ error: "card_id (string) required" }, 400);
  }
  if (!body.course || typeof body.course !== "string") {
    return c.json({ error: "course (string) required" }, 400);
  }
  if (typeof body.grade !== "number" || !Number.isInteger(body.grade)) {
    return c.json({ error: "grade (integer) required" }, 400);
  }
  if (body.grade < 0 || body.grade > 3) {
    return c.json({ error: "Geçersiz not. 0=Tekrar 1=Zor 2=İyi 3=Kolay" }, 400);
  }

  // Get current state
  const currentState = await c.env.DB.prepare(
    "SELECT * FROM flashcard_state WHERE card_id = ?"
  )
    .bind(body.card_id)
    .first<FlashcardState>();

  const now = Date.now();
  const s = schedule(currentState as unknown as StoredSrs | null, body.grade);

  // streak yalnızca gösterim için tutuluyor; planlamayı FSRS yapıyor
  const streak = body.grade === 0 ? 0 : (currentState?.streak ?? 0) + 1;

  if (currentState) {
    await c.env.DB.prepare(
      `UPDATE flashcard_state
       SET next_review = ?, last_seen = ?, streak = ?, interval_days = ?,
           stability = ?, difficulty = ?, elapsed_days = ?, scheduled_days = ?,
           reps = ?, lapses = ?, fsrs_state = ?, last_review = ?
       WHERE card_id = ?`
    )
      .bind(s.next_review, now, streak, s.scheduled_days,
            s.stability, s.difficulty, s.elapsed_days, s.scheduled_days,
            s.reps, s.lapses, s.fsrs_state, s.last_review, body.card_id)
      .run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO flashcard_state
         (card_id, course, ease, interval_days, next_review, last_seen, streak,
          stability, difficulty, elapsed_days, scheduled_days, reps, lapses,
          fsrs_state, last_review)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(body.card_id, body.course, 2.5, s.scheduled_days, s.next_review, now, streak,
            s.stability, s.difficulty, s.elapsed_days, s.scheduled_days,
            s.reps, s.lapses, s.fsrs_state, s.last_review)
      .run();
  }

  return c.json({
    success: true,
    newState: {
      card_id: body.card_id,
      course: body.course,
      next_review: s.next_review,
      interval_days: s.scheduled_days,
      stability: s.stability,
      difficulty: s.difficulty,
      reps: s.reps,
      lapses: s.lapses,
      last_seen: now,
      streak,
    },
  });
});
