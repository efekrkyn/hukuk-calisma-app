import { Hono } from "hono";

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
  const body = await c.req.json<{
    card_id: string;
    course: string;
    grade: number; // 0: Again, 1: Hard, 2: Good
  }>();

  if (body.grade < 0 || body.grade > 2) {
    return c.json({ error: "Invalid grade. Must be 0, 1, or 2." }, 400);
  }

  // Get current state
  const currentState = await c.env.DB.prepare(
    "SELECT * FROM flashcard_state WHERE card_id = ?"
  )
    .bind(body.card_id)
    .first<FlashcardState>();

  const now = Date.now();
  let ease = currentState ? currentState.ease : 2.5;
  let interval_days = currentState ? currentState.interval_days : 0;
  let streak = currentState ? currentState.streak : 0;

  // Simplified SuperMemo-2 algorithm adaptation
  // grade 0 (Again): ease decreases by 0.2, interval = 1, streak resets
  // grade 1 (Hard): ease decreases by 0.15, interval *= 1.2, streak increments
  // grade 2 (Good): ease stays or increases slightly, interval *= ease, streak increments
  
  if (body.grade === 0) {
    streak = 0;
    interval_days = 1;
    ease = Math.max(1.3, ease - 0.2);
  } else if (body.grade === 1) {
    streak += 1;
    interval_days = interval_days === 0 ? 1 : Math.round(interval_days * 1.2);
    ease = Math.max(1.3, ease - 0.15);
  } else if (body.grade === 2) {
    streak += 1;
    if (interval_days === 0) {
      interval_days = 1;
    } else if (interval_days === 1) {
      interval_days = 3;
    } else {
      interval_days = Math.round(interval_days * ease);
    }
  }

  // Ensure interval_days isn't smaller than 1 if grade > 0
  if (body.grade > 0 && interval_days < 1) interval_days = 1;

  // Next review in ms
  const next_review = now + interval_days * 24 * 60 * 60 * 1000;

  if (currentState) {
    await c.env.DB.prepare(
      `UPDATE flashcard_state 
       SET ease = ?, interval_days = ?, next_review = ?, last_seen = ?, streak = ?
       WHERE card_id = ?`
    )
      .bind(ease, interval_days, next_review, now, streak, body.card_id)
      .run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO flashcard_state (card_id, course, ease, interval_days, next_review, last_seen, streak)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(body.card_id, body.course, ease, interval_days, next_review, now, streak)
      .run();
  }

  return c.json({
    success: true,
    newState: {
      card_id: body.card_id,
      course: body.course,
      ease,
      interval_days,
      next_review,
      last_seen: now,
      streak,
    },
  });
});
