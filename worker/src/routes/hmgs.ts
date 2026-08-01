import { Hono } from "hono";
import {
  HMGS_SUBJECTS,
  HMGS_TOTAL_QUESTIONS,
  HMGS_PASS_SCORE,
  getSubject,
} from "../lib/hmgs-subjects";
import { generateQuestions } from "../lib/hmgs-generator";

type Bindings = {
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  DB?: D1Database;
  DEEPSEEK_API_KEY?: string;
};

export const hmgs = new Hono<{ Bindings: Bindings }>();

/** Resmî dağılım — UI kaç soru/hangi alan bilsin diye. */
hmgs.get("/subjects", (c) =>
  c.json({
    total: HMGS_TOTAL_QUESTIONS,
    pass_score: HMGS_PASS_SCORE,
    subjects: HMGS_SUBJECTS,
  })
);

/** Banka kapsamı: hangi alanda kaç soru var, tam deneme çıkar mı. */
hmgs.get("/stats", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB yok" }, 503);

  const rows = await c.env.DB.prepare(
    `SELECT subject, COUNT(*) as n FROM hmgs_questions GROUP BY subject`
  ).all<{ subject: string; n: number }>();

  const have = new Map(rows.results.map((r) => [r.subject, r.n]));
  const subjects = HMGS_SUBJECTS.map((s) => ({
    id: s.id,
    name: s.name,
    needed: s.count,
    have: have.get(s.id) ?? 0,
    // korpusta dayanak kanun yoksa bu alan hiç dolmaz — sebebi görünsün
    coverable: s.lawFiles.length > 0,
  }));

  const total = subjects.reduce((a, s) => a + s.have, 0);
  const coverable = subjects.filter((s) => s.coverable);
  const ready = coverable.every((s) => s.have >= s.needed);

  return c.json({
    total,
    ready,
    subjects,
    uncoverable: subjects.filter((s) => !s.coverable).map((s) => s.name),
  });
});

/** Bir alan için özgün soru üretip bankaya yazar. */
hmgs.post("/generate", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB yok" }, 503);
  if (!c.env.DEEPSEEK_API_KEY) {
    return c.json({ error: "DEEPSEEK_API_KEY tanımlı değil" }, 503);
  }

  let body: { subject?: string; count?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const subject = getSubject(String(body.subject ?? ""));
  if (!subject) return c.json({ error: "geçersiz subject" }, 400);

  const count = Math.min(Math.max(Number(body.count ?? 5), 1), 10);

  const questions = await generateQuestions(
    { AI: c.env.AI, VECTORIZE: c.env.VECTORIZE, DB: c.env.DB, DEEPSEEK_API_KEY: c.env.DEEPSEEK_API_KEY },
    subject,
    count
  );

  if (questions.length === 0) {
    return c.json({ error: "soru üretilemedi", subject: subject.id, inserted: 0 }, 502);
  }

  const now = Date.now();
  const stmt = c.env.DB.prepare(
    `INSERT INTO hmgs_questions
       (id, subject, question, options, correct_answer, explanation, source_pdf, source_page, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  await c.env.DB.batch(
    questions.map((q) =>
      stmt.bind(
        crypto.randomUUID(),
        subject.id,
        q.question,
        JSON.stringify(q.options),
        q.correctAnswer,
        q.explanation,
        q.source_pdf ?? null,
        q.source_page ?? null,
        now
      )
    )
  );

  return c.json({ ok: true, subject: subject.id, inserted: questions.length });
});

/**
 * Resmî dağılıma göre deneme oluşturur.
 * Bankada yetmeyen alan olursa eldekiyle döner ve eksiği `shortfall`'da bildirir —
 * sessizce kısa deneme vermek, kullanıcının gerçek sınavı yanlış tanımasına yol açar.
 */
hmgs.get("/exam", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB yok" }, 503);

  const size = Math.min(Math.max(Number(c.req.query("count") ?? HMGS_TOTAL_QUESTIONS), 10), HMGS_TOTAL_QUESTIONS);
  const scale = size / HMGS_TOTAL_QUESTIONS;

  const picked: any[] = [];
  const shortfall: Array<{ subject: string; needed: number; have: number }> = [];

  for (const s of HMGS_SUBJECTS) {
    const need = Math.max(1, Math.round(s.count * scale));
    const rows = await c.env.DB.prepare(
      `SELECT id, subject, question, options, correct_answer, explanation, source_pdf, source_page
         FROM hmgs_questions WHERE subject = ? ORDER BY RANDOM() LIMIT ?`
    ).bind(s.id, need).all<any>();

    for (const r of rows.results) {
      picked.push({
        id: r.id,
        subject: r.subject,
        subject_name: s.name,
        question: r.question,
        options: JSON.parse(r.options),
        correctAnswer: r.correct_answer,
        explanation: r.explanation,
        source_pdf: r.source_pdf,
        source_page: r.source_page,
      });
    }
    if (rows.results.length < need) {
      shortfall.push({ subject: s.name, needed: need, have: rows.results.length });
    }
  }

  // Alanlar arası karıştır — gerçek sınavda sorular alan alan sıralı gelmiyor
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }

  return c.json({
    exam_id: crypto.randomUUID(),
    requested: size,
    questions: picked,
    pass_score: HMGS_PASS_SCORE,
    shortfall,
  });
});

/** Deneme sonucunu kaydeder. */
hmgs.post("/submit", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB yok" }, 503);

  let body: {
    exam_id?: string;
    answers?: Array<{ question_id: string; subject: string; selected: number | null; correct: boolean }>;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const examId = String(body.exam_id ?? "");
  const answers = Array.isArray(body.answers) ? body.answers : [];
  if (!examId || answers.length === 0) {
    return c.json({ error: "exam_id ve answers gerekli" }, 400);
  }

  const now = Date.now();
  const stmt = c.env.DB.prepare(
    `INSERT INTO hmgs_attempts (id, question_id, subject, selected_answer, is_correct, exam_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  await c.env.DB.batch(
    answers.map((a) =>
      stmt.bind(
        crypto.randomUUID(),
        String(a.question_id),
        String(a.subject),
        a.selected === null || a.selected === undefined ? null : Number(a.selected),
        a.correct ? 1 : 0,
        examId,
        now
      )
    )
  );

  const correct = answers.filter((a) => a.correct).length;
  const score = Math.round((correct / answers.length) * 100);

  return c.json({
    ok: true,
    correct,
    total: answers.length,
    score,
    passed: score >= HMGS_PASS_SCORE,
  });
});
