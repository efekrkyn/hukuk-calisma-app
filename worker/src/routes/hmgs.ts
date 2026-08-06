import { Hono } from "hono";
import {
  HMGS_SUBJECTS,
  HMGS_TOTAL_QUESTIONS,
  HMGS_PASS_SCORE,
  getSubject,
} from "../lib/hmgs-subjects";
import { generateQuestions, lengthRatio, MAX_LENGTH_RATIO } from "../lib/hmgs-generator";
import { apportion } from "../lib/apportion";
import { shuffleOptions } from "../lib/shuffle-options";
import { isNearDuplicate } from "../lib/near-duplicate";
import { verifyBatch, type QuestionToCheck } from "../lib/hmgs-verify";
import { schedule } from "../lib/srs";

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

      // Uzunluk kapısı üretimde var ama ondan ÖNCE üretilmiş 604 soru izi
      // taşıyor (doğru şık %46 oranında en uzun olan). Silmek yerine
      // denemeye sokmuyoruz — banka 1440'a çıktığı için bu artık karşılanabilir.
      const opts = JSON.parse(r.options) as string[];
      if (lengthRatio(opts, r.correct_answer as number) > MAX_LENGTH_RATIO) continue;

      picked.push(
        shuffleOptions({
          id: r.id,
          subject: r.subject,
          subject_name: s.name,
          question: r.question,
          options: opts,
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

  // Bilinmeyen soru tekrar kuyruğuna girer. Boş bırakılan da dahil: boş,
  // "biliyordum ama işaretlemedim"den çok "bilmiyordum" demek.
  const missed = answers.filter((a) => !a.correct);
  if (missed.length > 0) {
    const enq = c.env.DB.prepare(
      `INSERT INTO hmgs_review (question_id, subject, next_review, added_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(question_id) DO UPDATE SET
         next_review = excluded.next_review,
         lapses = lapses + 1`
    );
    await c.env.DB.batch(
      missed.map((a) => enq.bind(String(a.question_id), String(a.subject), now, now))
    );
  }

  const correct = answers.filter((a) => a.correct).length;
  const score = Math.round((correct / answers.length) * 100);

  return c.json({
    ok: true,
    correct,
    total: answers.length,
    score,
    passed: score >= HMGS_PASS_SCORE,
    queued_for_review: missed.length,
  });
});

/**
 * Kendi performansın: deneme bazında net ve alan bazında doğruluk.
 *
 * hmgs_attempts baştan beri yazılıyordu ama hiçbir yerden okunmuyordu —
 * uygulama her cevabı kaydedip kullanıcıya hiçbir şey göstermiyordu.
 */
hmgs.get("/performance", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB yok" }, 503);

  const [exams, subjects] = await Promise.all([
    c.env.DB.prepare(
      `SELECT exam_id, MIN(created_at) AS at, COUNT(*) AS n, SUM(is_correct) AS dogru
         FROM hmgs_attempts GROUP BY exam_id ORDER BY at DESC LIMIT 30`
    ).all<{ exam_id: string; at: number; n: number; dogru: number }>(),
    c.env.DB.prepare(
      `SELECT subject, COUNT(*) AS n, SUM(is_correct) AS dogru
         FROM hmgs_attempts GROUP BY subject`
    ).all<{ subject: string; n: number; dogru: number }>(),
  ]);

  const name = new Map(HMGS_SUBJECTS.map((s) => [s.id, s.name]));
  const bySubject = subjects.results
    .map((r) => ({
      id: r.subject,
      name: name.get(r.subject) ?? r.subject,
      answered: r.n,
      correct: r.dogru,
      accuracy: r.n > 0 ? Math.round((r.dogru / r.n) * 100) : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  const byExam = exams.results.map((r) => ({
    exam_id: r.exam_id,
    at: r.at,
    total: r.n,
    correct: r.dogru,
    score: r.n > 0 ? Math.round((r.dogru / r.n) * 100) : 0,
  }));

  const answered = subjects.results.reduce((a, r) => a + r.n, 0);
  const correct = subjects.results.reduce((a, r) => a + r.dogru, 0);

  const due = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM hmgs_review WHERE next_review <= ?`
  ).bind(Date.now()).first<{ n: number }>();

  return c.json({
    exams: byExam,
    subjects: bySubject,
    // Az veriyle alan sıralaması gürültüden ibaret; eşiği UI'ya bildir.
    min_answers_for_ranking: 5,
    overall: {
      exams: byExam.length,
      answered,
      correct,
      accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
      pass_score: HMGS_PASS_SCORE,
    },
    review_due: due?.n ?? 0,
  });
});

/** Tekrar kuyruğunda vakti gelmiş sorular. */
hmgs.get("/review", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB yok" }, 503);

  const limit = Math.min(Math.max(Number(c.req.query("count") ?? 20), 1), 50);
  const rows = await c.env.DB.prepare(
    `SELECT q.id, q.subject, q.question, q.options, q.correct_answer, q.explanation,
            r.reps, r.lapses, r.next_review
       FROM hmgs_review r JOIN hmgs_questions q ON q.id = r.question_id
       LEFT JOIN hmgs_verdicts v ON v.question_id = q.id
      WHERE r.next_review <= ? AND (v.verified IS NULL OR v.verified >= 0)
      ORDER BY r.next_review LIMIT ?`
  ).bind(Date.now(), limit).all<any>();

  const name = new Map(HMGS_SUBJECTS.map((s) => [s.id, s.name]));
  const questions = rows.results.map((r) => {
    // JSON.parse `any` döner; tip açıkça yazılmazsa shuffleOptions'ın generic
    // kısıtı devre dışı kalıyor ve yanlış imzayla çağrı tsc'den geçiyor.
    const options: string[] = JSON.parse(r.options);
    const shuffled = shuffleOptions({
      options,
      correctAnswer: r.correct_answer as number,
    });
    return {
      id: r.id,
      subject: r.subject,
      subject_name: name.get(r.subject) ?? r.subject,
      question: r.question,
      options: shuffled.options,
      correctAnswer: shuffled.correctAnswer,
      explanation: r.explanation,
      reps: r.reps,
      lapses: r.lapses,
    };
  });

  const total = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM hmgs_review WHERE next_review <= ?`
  ).bind(Date.now()).first<{ n: number }>();

  return c.json({ questions, due_total: total?.n ?? 0 });
});

/** Tekrar sonucunu işle: FSRS bir sonraki tarihi belirler. */
hmgs.post("/review/grade", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB yok" }, 503);

  let body: { question_id?: string; grade?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const id = String(body.question_id ?? "");
  const grade = Number(body.grade);
  if (!id || !Number.isFinite(grade) || grade < 0 || grade > 3) {
    return c.json({ error: "question_id ve grade (0-3) gerekli" }, 400);
  }

  const row = await c.env.DB.prepare(
    `SELECT stability, difficulty, elapsed_days, scheduled_days, reps, lapses,
            fsrs_state, last_review
       FROM hmgs_review WHERE question_id = ?`
  ).bind(id).first<any>();
  if (!row) return c.json({ error: "soru tekrar kuyruğunda değil" }, 404);

  const next = schedule(row, grade);

  await c.env.DB.prepare(
    `UPDATE hmgs_review SET
       stability = ?, difficulty = ?, elapsed_days = ?, scheduled_days = ?,
       reps = ?, lapses = ?, fsrs_state = ?, next_review = ?, last_review = ?
     WHERE question_id = ?`
  ).bind(
    next.stability, next.difficulty, next.elapsed_days, next.scheduled_days,
    next.reps, next.lapses, next.fsrs_state, next.next_review, next.last_review,
    id
  ).run();

  return c.json({
    ok: true,
    next_review: next.next_review,
    interval_days: next.scheduled_days,
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
