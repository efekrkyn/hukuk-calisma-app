import { Hono } from "hono";
import {
  HMGS_SUBJECTS,
  HMGS_TOTAL_QUESTIONS,
  HMGS_PASS_SCORE,
  getSubject,
} from "../lib/hmgs-subjects";
import { generateQuestions } from "../lib/hmgs-generator";
import { apportion } from "../lib/apportion";
import { shuffleOptions } from "../lib/shuffle-options";
import { isNearDuplicate } from "../lib/near-duplicate";
import { verifyBatch, type QuestionToCheck } from "../lib/hmgs-verify";

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
    // Kanun ya da doktrin kaynağı yoksa bu alan hiç dolmaz — sebebi görünsün
    coverable: s.lawFiles.length > 0 || Boolean(s.ragCourse),
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

  const onlyVerified = c.req.query("verified") === "1";

  // ?subject=X → tek alan çalışması. Ana sayfadaki alan kartları buraya
  // bağlanıyor; o alanın tamamı istenen sayı kadar soruyla geliyor.
  const onlySubject = c.req.query("subject");
  const pool = onlySubject
    ? HMGS_SUBJECTS.filter((s) => s.id === onlySubject)
    : HMGS_SUBJECTS;
  if (onlySubject && pool.length === 0) {
    return c.json({ error: "geçersiz subject" }, 400);
  }

  // Alan başına round() toplamı tutturmuyordu (20 istenince 26 dönüyordu).
  const quota = apportion(pool.map((s) => s.count), size);

  const picked: any[] = [];
  const shortfall: Array<{ subject: string; needed: number; have: number }> = [];

  for (const [si, s] of pool.entries()) {
    const need = quota[si];
    if (need === 0) continue;
    // Tekrar elenince kota açık kalmasın: fazladan aday çek, kotayı dolduran
    // ilk `need` tanesini al. (20 istenip 19 dönüyordu.)
    // Denetimde ELENEN soru hiçbir koşulda denemeye girmez — hakem "yanlış"
    // dediyse onu sormak çalışmayı bozar. verified=1 ise yalnızca onaylılar.
    const rows = await c.env.DB.prepare(
      `SELECT q.id, q.subject, q.question, q.options, q.correct_answer,
              q.explanation, q.source_pdf, q.source_page, v.verified
         FROM hmgs_questions q
         LEFT JOIN hmgs_verdicts v ON v.question_id = q.id
        WHERE q.subject = ?
          AND (v.verified IS NULL OR v.verified >= 0)
          ${onlyVerified ? "AND v.verified = 1" : ""}
        ORDER BY RANDOM() LIMIT ?`
    ).bind(s.id, need * 3).all<any>();

    let taken = 0;
    for (const r of rows.results) {
      if (taken >= need) break;
      // Üretim parti parti çalıştığı için banka neredeyse aynı soruyu birden
      // fazla içerebiliyor; aynı denemede iki kez sormanın anlamı yok.
      if (picked.some((p) => isNearDuplicate(p.question, r.question))) continue;

      picked.push(
        shuffleOptions({
          id: r.id,
          subject: r.subject,
          subject_name: s.name,
          question: r.question,
          options: JSON.parse(r.options) as string[],
          correctAnswer: r.correct_answer as number,
          explanation: r.explanation,
          source_pdf: r.source_pdf,
          source_page: r.source_page,
          verified: r.verified === 1,
        })
      );
      taken++;
    }
    if (taken < need) {
      shortfall.push({ subject: s.name, needed: need, have: taken });
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
    verified_count: picked.filter((q) => q.verified).length,
    only_verified: onlyVerified,
    subject: onlySubject ?? null,
    subject_name: onlySubject ? pool[0].name : null,
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


/** Bir alandaki denetlenmemiş soruları kanun metnine karşı denetler. */
hmgs.post("/verify", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB yok" }, 503);
  if (!c.env.DEEPSEEK_API_KEY) return c.json({ error: "DEEPSEEK_API_KEY yok" }, 503);

  let body: { subject?: string; limit?: number; recheck?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const subject = getSubject(String(body.subject ?? ""));
  if (!subject) return c.json({ error: "geçersiz subject" }, 400);

  // Aynı anda çok soru göndermek hakemi sulandırıyor; küçük parti tut.
  const limit = Math.min(Math.max(Number(body.limit ?? 5), 1), 8);

  // recheck=1: "unsupported" damgalıları yeniden dene. Çoğu kötü soru değil,
  // hakemin doğru maddeyi görememesiydi.
  const recheck = body.recheck === true;
  const rows = await c.env.DB.prepare(
    recheck
      ? `SELECT q.id, q.question, q.options, q.correct_answer, q.explanation
           FROM hmgs_questions q
           JOIN hmgs_verdicts v ON v.question_id = q.id
          WHERE q.subject = ? AND v.verified = 0
          LIMIT ?`
      : `SELECT q.id, q.question, q.options, q.correct_answer, q.explanation
           FROM hmgs_questions q
           LEFT JOIN hmgs_verdicts v ON v.question_id = q.id
          WHERE q.subject = ? AND v.question_id IS NULL
          LIMIT ?`
  ).bind(subject.id, limit).all<any>();

  if (rows.results.length === 0) {
    return c.json({ ok: true, subject: subject.id, checked: 0, remaining: 0 });
  }

  const questions: QuestionToCheck[] = rows.results.map((r) => ({
    id: r.id,
    question: r.question,
    options: JSON.parse(r.options),
    correctAnswer: r.correct_answer,
    explanation: r.explanation,
  }));

  const verdicts = await verifyBatch(
    { AI: c.env.AI, VECTORIZE: c.env.VECTORIZE, DB: c.env.DB, DEEPSEEK_API_KEY: c.env.DEEPSEEK_API_KEY },
    subject,
    questions
  );

  if (verdicts.length === 0) {
    return c.json({ error: "denetim sonucu alınamadı", subject: subject.id, checked: 0 }, 502);
  }

  const now = Date.now();
  const stmt = c.env.DB.prepare(
    `INSERT OR REPLACE INTO hmgs_verdicts (question_id, verified, verdict, reason, checked_at)
     VALUES (?, ?, ?, ?, ?)`
  );
  await c.env.DB.batch(
    verdicts.map((v) =>
      // correct = 1 (onaylı) · unsupported = 0 (kaynakta doğrulanamadı, YANLIŞ
      // demek değil — retrieval doğru maddeyi getirmemiş olabilir) · wrong = -1
      stmt.bind(
        v.id,
        v.verdict === "correct" ? 1 : v.verdict === "unsupported" ? 0 : -1,
        v.verdict,
        v.reason,
        now
      )
    )
  );

  const left = await c.env.DB.prepare(
    recheck
      ? `SELECT COUNT(*) as n FROM hmgs_questions q
           JOIN hmgs_verdicts v ON v.question_id = q.id
          WHERE q.subject = ? AND v.verified = 0`
      : `SELECT COUNT(*) as n FROM hmgs_questions q
           LEFT JOIN hmgs_verdicts v ON v.question_id = q.id
          WHERE q.subject = ? AND v.question_id IS NULL`
  ).bind(subject.id).first<{ n: number }>();

  return c.json({
    ok: true,
    subject: subject.id,
    checked: verdicts.length,
    remaining: left?.n ?? 0,
    verdicts,
  });
});

/** Denetim özeti. */
hmgs.get("/verify-stats", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB yok" }, 503);

  const rows = await c.env.DB.prepare(
    `SELECT q.subject, v.verdict, COUNT(*) as n
       FROM hmgs_questions q
       LEFT JOIN hmgs_verdicts v ON v.question_id = q.id
      GROUP BY q.subject, v.verdict`
  ).all<{ subject: string; verdict: string | null; n: number }>();

  const by: Record<string, Record<string, number>> = {};
  let total = 0, correct = 0, unchecked = 0;
  for (const r of rows.results) {
    const key = r.verdict ?? "unchecked";
    (by[r.subject] ??= {})[key] = r.n;
    total += r.n;
    if (key === "correct") correct += r.n;
    if (key === "unchecked") unchecked += r.n;
  }
  return c.json({ total, correct, unchecked, by_subject: by });
});
