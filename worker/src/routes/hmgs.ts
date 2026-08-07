import { Hono } from "hono";
import {
  HMGS_SUBJECTS,
  HMGS_TOTAL_QUESTIONS,
  HMGS_PASS_SCORE,
  getSubject,
} from "../lib/hmgs-subjects";
import { generateQuestions, lengthRatio, MAX_LENGTH_RATIO } from "../lib/hmgs-generator";
import { generateTopic } from "../lib/hmgs-topic";
import { classifyQuestions } from "../lib/hmgs-classify";
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

  let body: { subject?: string; count?: number; subtopic?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const subject = getSubject(String(body.subject ?? ""));
  if (!subject) return c.json({ error: "geçersiz subject" }, 400);

  const count = Math.min(Math.max(Number(body.count ?? 5), 1), 10);

  // Hedefli üretim: bankanın ince kaldığı alt konuyu doğrudan doldurmak için.
  // Doğrulama üreticinin içinde de var ama burada erken hata vermek, sessizce
  // rastgele bir konudan üretip "oldu" demekten iyi.
  const wantSubtopic = body.subtopic ? String(body.subtopic) : undefined;
  if (wantSubtopic) {
    const gecerli = [...(subject.subtopics ?? []), ...(subject.doctrineSubtopics ?? [])];
    if (!gecerli.includes(wantSubtopic)) {
      return c.json({ error: "geçersiz subtopic" }, 400);
    }
  }

  const questions = await generateQuestions(
    { AI: c.env.AI, VECTORIZE: c.env.VECTORIZE, DB: c.env.DB, DEEPSEEK_API_KEY: c.env.DEEPSEEK_API_KEY },
    subject,
    count,
    wantSubtopic
  );

  if (questions.length === 0) {
    return c.json({ error: "soru üretilemedi", subject: subject.id, inserted: 0 }, 502);
  }

  // Tekrar kapısı INSERT'ten ÖNCE. Daha önce yalnızca deneme kurulurken
  // (/exam) eleniyordu; banka yazarken elenmediği için 1841 sorunun %13'ü
  // (239 soru) kendi alanı içinde yakın eşe sahipti, üç çift birebir aynıydı.
  // Model bankada ne olduğunu bilmediğinden aynı soruyu tekrar üretiyor.
  // Yalnızca bu alanın `question` sütunu yeterli — tekrar alanlar arası olmaz.
  const existing = await c.env.DB.prepare(
    `SELECT question FROM hmgs_questions WHERE subject = ?`
  ).bind(subject.id).all<{ question: string }>();

  const seen = existing.results.map((r) => r.question);
  const fresh = questions.filter((q) => {
    // Bankaya karşı VE aynı partide tutulanlara karşı: model tek çağrıda da
    // aynı soruyu iki kez üretebiliyor.
    if (seen.some((s) => isNearDuplicate(s, q.question))) return false;
    seen.push(q.question);
    return true;
  });

  const skipped = questions.length - fresh.length;

  // Hepsi elendiyse hata değil — alan doymuş ya da model tekrar etmiş demek.
  // Üretim betiği farkı görsün diye `skipped` her koşulda yanıtta.
  if (fresh.length === 0) {
    return c.json({ ok: true, subject: subject.id, inserted: 0, skipped });
  }

  const now = Date.now();
  const stmt = c.env.DB.prepare(
    `INSERT INTO hmgs_questions
       (id, subject, question, options, correct_answer, explanation, source_pdf, source_page, created_at, subtopic)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  await c.env.DB.batch(
    fresh.map((q) =>
      stmt.bind(
        crypto.randomUUID(),
        subject.id,
        q.question,
        JSON.stringify(q.options),
        q.correctAnswer,
        q.explanation,
        q.source_pdf ?? null,
        q.source_page ?? null,
        now,
        q.subtopic ?? null
      )
    )
  );

  return c.json({ ok: true, subject: subject.id, inserted: fresh.length, skipped });
});

/**
 * Resmî dağılıma göre deneme oluşturur.
 * Bankada yetmeyen alan olursa eldekiyle döner ve eksiği `shortfall`'da bildirir —
 * sessizce kısa deneme vermek, kullanıcının gerçek sınavı yanlış tanımasına yol açar.
 */
hmgs.get("/exam", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB yok" }, 503);

  const size = Math.min(Math.max(Number(c.req.query("count") ?? HMGS_TOTAL_QUESTIONS), 10), HMGS_TOTAL_QUESTIONS);

  // VARSAYILAN: yalnızca denetlenmiş sorular. Eskiden tersiydi ve 120 soruluk
  // denemenin 28'i denetlenmemiş çıkıyordu — hazırlık uygulamasında kabul
  // edilemez bir oran. Ölçüldü: 2116 onaylı soruyla 20 alanın HEPSİ kotasını
  // dolduruyor, yani filtre denemeyi kısaltmıyor.
  // verified=0 ile kapatılabilir (banka bir alanda çökerse kaçış yolu).
  const onlyVerified = c.req.query("verified") !== "0";

  // ?subject=X → tek alan çalışması. Ana sayfadaki alan kartları buraya
  // bağlanıyor; o alanın tamamı istenen sayı kadar soruyla geliyor.
  const onlySubject = c.req.query("subject");
  const pool = onlySubject
    ? HMGS_SUBJECTS.filter((s) => s.id === onlySubject)
    : HMGS_SUBJECTS;
  if (onlySubject && pool.length === 0) {
    return c.json({ error: "geçersiz subject" }, 400);
  }

  // ?subtopic=X → konu anlatımından "bu konuyu çöz" bağlantısı. Yalnızca
  // alanla birlikte anlamlı; alt konu adları alanlar arasında benzersiz değil
  // ("zamanaşımı" birden çok alanda geçiyor), tek başına filtrelemek karışık
  // alan döndürürdü.
  const onlySubtopic = onlySubject ? c.req.query("subtopic") : null;
  if (onlySubtopic) {
    const s = pool[0];
    const gecerli = [...(s.subtopics ?? []), ...(s.doctrineSubtopics ?? [])];
    if (!gecerli.includes(onlySubtopic)) {
      return c.json({ error: "geçersiz subtopic" }, 400);
    }
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
    // Kullanıcının "hatalı" diye bildirdiği ve sahibinin henüz karara bağlamadığı
    // soru da aynı sebeple gelmez: şüpheli soruyu sormaya devam etmenin faydası yok.
    const rows = await c.env.DB.prepare(
      `SELECT q.id, q.subject, q.question, q.options, q.correct_answer,
              q.explanation, q.source_pdf, q.source_page, v.verified
         FROM hmgs_questions q
         LEFT JOIN hmgs_verdicts v ON v.question_id = q.id
         LEFT JOIN hmgs_reports rp ON rp.question_id = q.id AND rp.resolved = 0
        WHERE q.subject = ?
          AND (v.verified IS NULL OR v.verified >= 0)
          AND rp.question_id IS NULL
          ${onlyVerified ? "AND v.verified = 1" : ""}
          ${onlySubtopic ? "AND q.subtopic = ?" : ""}
        ORDER BY RANDOM() LIMIT ?`
    ).bind(...(onlySubtopic ? [s.id, onlySubtopic, need * 3] : [s.id, need * 3])).all<any>();

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

  // Alan-altı zayıflık. "Borçlar'da zayıfsın" eyleme dönüşmüyor — Borçlar'ın
  // 10 alt konusu var; hangisine çalışacağını söylemiyor. Alt konu etiketi
  // sonradan eklendi ve 3051 sorunun tamamına atandı, artık bu kırılım
  // çıkarılabiliyor. NULL etikete karşı korumalı: etiketsiz soru sayılmaz.
  const subs = await c.env.DB.prepare(
    `SELECT q.subject, q.subtopic, COUNT(*) AS n, SUM(a.is_correct) AS dogru
       FROM hmgs_attempts a JOIN hmgs_questions q ON q.id = a.question_id
      WHERE q.subtopic IS NOT NULL
      GROUP BY q.subject, q.subtopic`
  ).all<{ subject: string; subtopic: string; n: number; dogru: number }>();

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
    // Sayaç, soruları GETİREN sorguyla aynı ölçütü kullanmalı; yoksa
    // "22 soru tekrar bekliyor" deyip 20 soru gelir.
    `SELECT COUNT(*) AS n
       FROM hmgs_review r
       JOIN hmgs_verdicts v ON v.question_id = r.question_id
       LEFT JOIN hmgs_reports rp ON rp.question_id = r.question_id AND rp.resolved = 0
      WHERE r.next_review <= ? AND v.verified = 1 AND rp.question_id IS NULL`
  ).bind(Date.now()).first<{ n: number }>();

  // Alt konu eşiği alandan DÜŞÜK (3): bir alt konu bir denemede 1-2 soru
  // görüyor, 5 eşiği tutulursa kırılım aylarca boş kalır. Az veriyi de
  // gösteriyoruz ama `answered` alanı yanında, UI temkinli yazabilsin.
  const bySubtopic = subs.results
    .filter((r) => r.n >= 3)
    .map((r) => ({
      subject: r.subject,
      subject_name: name.get(r.subject) ?? r.subject,
      subtopic: r.subtopic,
      answered: r.n,
      correct: r.dogru,
      accuracy: r.n > 0 ? Math.round((r.dogru / r.n) * 100) : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 8);

  return c.json({
    exams: byExam,
    subjects: bySubject,
    subtopics: bySubtopic,
    // Az veriyle alan sıralaması gürültüden ibaret; eşiği UI'ya bildir.
    min_answers_for_ranking: 5,
    min_answers_for_subtopic: 3,
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

/**
 * Deneme geçmişi — liste.
 *
 * /performance zaten deneme başına net veriyor ama geçme barajı ve boş
 * sayısı yok; "3 Ağustos'ta ne yaptım" sorusuna cevap vermeyen bir özet.
 * Alan kırılımı bilerek YOK: liste 30 satır, her satır için ikinci bir
 * GROUP BY taraması sayfanın açılışını yavaşlatır — kırılım detayda.
 */
hmgs.get("/exams", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB yok" }, 503);

  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 30), 1), 100);

  const rows = await c.env.DB.prepare(
    `SELECT exam_id,
            MIN(created_at) AS at,
            COUNT(*) AS n,
            SUM(is_correct) AS dogru,
            SUM(CASE WHEN selected_answer IS NULL THEN 1 ELSE 0 END) AS bos
       FROM hmgs_attempts
      GROUP BY exam_id
      ORDER BY at DESC
      LIMIT ?`
  ).bind(limit).all<{ exam_id: string; at: number; n: number; dogru: number; bos: number }>();

  return c.json({
    pass_score: HMGS_PASS_SCORE,
    exams: rows.results.map((r) => {
      const score = r.n > 0 ? Math.round((r.dogru / r.n) * 100) : 0;
      return {
        exam_id: r.exam_id,
        at: r.at,
        total: r.n,
        correct: r.dogru,
        // Yanlış türetiliyor: is_correct=0 hem yanlışı hem boşu kapsıyor,
        // boş ayrıca sayılmasa "yanlış" şişik görünürdü.
        wrong: r.n - r.dogru - r.bos,
        blank: r.bos,
        score,
        passed: score >= HMGS_PASS_SCORE,
      };
    }),
  });
});

/**
 * Tek denemenin soru soru dökümü.
 *
 * İKİ VERİ SINIRI var, ikisi de yanıt şemasında açıkça işaretli:
 *
 * 1) Silinen soru. Bildirilip bankadan kaldırılmış olabilir; JOIN düşerse
 *    satır ATLANMIYOR (`available: false` ile dönüyor). Atlansaydı geçmişteki
 *    120 soruluk deneme bugün 118 soru görünürdü — geriye dönük değişen net
 *    kullanıcının kendi kaydına güvenini bitirir.
 *
 * 2) İşaretlenen şıkkın METNİ bilinmiyor. /exam şıkları `shuffleOptions` ile
 *    KARIŞTIRARAK sunuyor ve permütasyon hiçbir yere yazılmıyor (Math.random,
 *    tohumsuz). `selected_answer` o karıştırılmış sıradaki indeks; bankadaki
 *    `options` sırasıyla eşleşmiyor. Bu yüzden indeks dışarı hiç verilmiyor:
 *    yanlış şık metni göstermek hiç göstermemekten kötü. Elde kesin bilinen
 *    tek şey `is_correct` ve boş olup olmadığı — `status` bunu taşıyor.
 *    (Doğru cevaplarda işaretlenen şık zaten doğru şık, ayrıca söylemeye gerek yok.)
 */
hmgs.get("/exams/:examId", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB yok" }, 503);

  const examId = c.req.param("examId");

  // rowid = ekleme sırası; /submit sorular hangi sırayla sunulduysa o sırayla
  // batch'liyor, yani denemedeki soru sırası buradan geliyor. UUID id'ye göre
  // sıralamak rastgele bir sıra verirdi.
  const rows = await c.env.DB.prepare(
    `SELECT a.question_id, a.subject, a.is_correct, a.selected_answer, a.created_at,
            q.id AS qid, q.question, q.options, q.correct_answer, q.explanation, q.subtopic
       FROM hmgs_attempts a
       LEFT JOIN hmgs_questions q ON q.id = a.question_id
      WHERE a.exam_id = ?
      ORDER BY a.rowid`
  ).bind(examId).all<{
    question_id: string;
    subject: string;
    is_correct: number;
    selected_answer: number | null;
    created_at: number;
    qid: string | null;
    question: string | null;
    options: string | null;
    correct_answer: number | null;
    explanation: string | null;
    subtopic: string | null;
  }>();

  if (rows.results.length === 0) return c.json({ error: "deneme bulunamadı" }, 404);

  const name = new Map(HMGS_SUBJECTS.map((s) => [s.id, s.name]));

  const questions = rows.results.map((r) => {
    const status =
      r.selected_answer === null ? "blank" : r.is_correct === 1 ? "correct" : "wrong";
    const available = r.qid !== null;
    return {
      question_id: r.question_id,
      subject: r.subject,
      subject_name: name.get(r.subject) ?? r.subject,
      subtopic: r.subtopic,
      status,
      /** Soru bankada duruyor mu — false ise metin/şık/açıklama yok. */
      available,
      question: available ? r.question : null,
      options: available && r.options ? (JSON.parse(r.options) as string[]) : [],
      correct_answer: available ? r.correct_answer : null,
      explanation: available ? r.explanation : null,
    };
  });

  // Alan özeti attempts'ten (q'dan değil) sayılıyor: silinen soru da alanının
  // toplamına dahil kalsın, yoksa özet dökümle tutmaz.
  const bySubject = new Map<string, { total: number; correct: number; blank: number }>();
  for (const q of questions) {
    const acc = bySubject.get(q.subject) ?? { total: 0, correct: 0, blank: 0 };
    acc.total++;
    if (q.status === "correct") acc.correct++;
    if (q.status === "blank") acc.blank++;
    bySubject.set(q.subject, acc);
  }

  const total = questions.length;
  const correct = questions.filter((q) => q.status === "correct").length;
  const blank = questions.filter((q) => q.status === "blank").length;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;

  return c.json({
    exam_id: examId,
    at: Math.min(...rows.results.map((r) => r.created_at)),
    total,
    correct,
    wrong: total - correct - blank,
    blank,
    score,
    passed: score >= HMGS_PASS_SCORE,
    pass_score: HMGS_PASS_SCORE,
    // Arayüz "senin cevabın: C" yazmaya kalkmasın diye açık uyarı.
    selected_option_known: false,
    by_subject: [...bySubject.entries()]
      .map(([id, v]) => ({
        id,
        name: name.get(id) ?? id,
        total: v.total,
        correct: v.correct,
        wrong: v.total - v.correct - v.blank,
        blank: v.blank,
        accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
      }))
      .sort((a, b) => a.accuracy - b.accuracy),
    questions,
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
       LEFT JOIN hmgs_reports rp ON rp.question_id = q.id AND rp.resolved = 0
      WHERE r.next_review <= ? AND v.verified = 1
        AND rp.question_id IS NULL
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
    // Sayaç, soruları GETİREN sorguyla aynı ölçütü kullanmalı; yoksa
    // "22 soru tekrar bekliyor" deyip 20 soru gelir.
    `SELECT COUNT(*) AS n
       FROM hmgs_review r
       JOIN hmgs_verdicts v ON v.question_id = r.question_id
       LEFT JOIN hmgs_reports rp ON rp.question_id = r.question_id AND rp.resolved = 0
      WHERE r.next_review <= ? AND v.verified = 1 AND rp.question_id IS NULL`
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


/**
 * "Bu soru hatalı" bildirimi — soruyu çözen kişiden gelen tek gerçek denetim.
 *
 * Bildirilen soru, sahibi karara varana kadar /exam ve /review havuzlarından düşer.
 * subject istemciden ALINMAZ, sorunun kendi kaydından okunur: istemcinin
 * gönderdiği alan adına güvenmek raporu yanlış alana yazmaya açık kapı bırakır.
 */
hmgs.post("/report", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB yok" }, 503);

  let body: { question_id?: string; reason?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const id = String(body.question_id ?? "");
  if (!id) return c.json({ error: "question_id gerekli" }, 400);

  const q = await c.env.DB.prepare(
    `SELECT subject FROM hmgs_questions WHERE id = ?`
  ).bind(id).first<{ subject: string }>();
  if (!q) return c.json({ error: "soru bulunamadı" }, 404);

  // Serbest metin; sahibine okunmak için var, uzunluğu sınırlı tutuluyor.
  const reason = String(body.reason ?? "").trim().slice(0, 1000);

  // question_id UNIQUE olduğu için tekrar bildirim yeni satır açmaz (gerekçe
  // 007-hmgs-reports.sql'de). "keep" ile kapatılmış bir kayıt yeniden bildirilirse
  // resolved sıfırlanır: kullanıcı hâlâ itiraz ediyorsa soru yine havuzdan düşmeli.
  // Boş gerekçe eskisini EZMEZ — ilk bildirimdeki açıklama sahibinin elindeki
  // tek bilgi olabilir.
  await c.env.DB.prepare(
    `INSERT INTO hmgs_reports (id, question_id, subject, reason, created_at, resolved)
     VALUES (?, ?, ?, ?, ?, 0)
     ON CONFLICT(question_id) DO UPDATE SET
       reason = COALESCE(NULLIF(excluded.reason, ''), reason),
       created_at = excluded.created_at,
       resolved = 0`
  ).bind(crypto.randomUUID(), id, q.subject, reason, Date.now()).run();

  return c.json({ ok: true, question_id: id });
});

/**
 * Açık bildirimler — sahibinin karar ekranı.
 *
 * Soru metni, şıklar, doğru cevap, açıklama ve varsa makine denetiminin gerekçesi
 * birlikte döner: karar vermek için başka bir sorgu gerekmesin.
 */
hmgs.get("/reports", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB yok" }, 503);

  const rows = await c.env.DB.prepare(
    `SELECT r.id, r.question_id, r.subject, r.reason, r.created_at,
            q.question, q.options, q.correct_answer, q.explanation,
            q.source_pdf, q.source_page,
            v.verified, v.verdict, v.reason AS verdict_reason
       FROM hmgs_reports r
       JOIN hmgs_questions q ON q.id = r.question_id
       LEFT JOIN hmgs_verdicts v ON v.question_id = r.question_id
      WHERE r.resolved = 0
      ORDER BY r.created_at DESC`
  ).all<any>();

  const name = new Map(HMGS_SUBJECTS.map((s) => [s.id, s.name]));
  const reports = rows.results.map((r) => {
    const options: string[] = JSON.parse(r.options);
    return {
      id: r.id,
      question_id: r.question_id,
      subject: r.subject,
      subject_name: name.get(r.subject) ?? r.subject,
      reason: r.reason ?? "",
      reported_at: r.created_at,
      question: r.question,
      // Şıklar bankadaki sırayla — kullanıcı karıştırılmış hâlini gördü ama
      // sahibinin kaynakla karşılaştıracağı sıra bu.
      options,
      correctAnswer: r.correct_answer as number,
      correct_option: options[r.correct_answer as number],
      explanation: r.explanation,
      source_pdf: r.source_pdf,
      source_page: r.source_page,
      // Makine denetimi varsa gerekçesiyle: kullanıcının itirazıyla aynı yöne
      // işaret ediyorsa karar kolaylaşır.
      verdict: r.verdict ?? null,
      verdict_reason: r.verdict_reason ?? null,
      verified: r.verified ?? null,
    };
  });

  return c.json({ reports, total: reports.length });
});

/** Bildirimi kapat: soruyu sil ya da tut. */
hmgs.post("/reports/resolve", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB yok" }, 503);

  let body: { question_id?: string; action?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const id = String(body.question_id ?? "");
  const action = String(body.action ?? "");
  if (!id || (action !== "delete" && action !== "keep")) {
    return c.json({ error: "question_id ve action (delete|keep) gerekli" }, 400);
  }

  if (action === "delete") {
    // Soruya bağlı her şey gider; hmgs_attempts KALIR — geçmiş performans
    // kaydı silinen soruyla birlikte yok olursa netler geriye dönük değişir.
    await c.env.DB.batch([
      c.env.DB.prepare(`DELETE FROM hmgs_questions WHERE id = ?`).bind(id),
      c.env.DB.prepare(`DELETE FROM hmgs_verdicts WHERE question_id = ?`).bind(id),
      c.env.DB.prepare(`DELETE FROM hmgs_review WHERE question_id = ?`).bind(id),
      c.env.DB.prepare(`DELETE FROM hmgs_reports WHERE question_id = ?`).bind(id),
    ]);
    return c.json({ ok: true, question_id: id, action });
  }

  // keep: soru havuza döner. Kullanıcı yine bildirirse resolved sıfırlanır.
  const res = await c.env.DB.prepare(
    `UPDATE hmgs_reports SET resolved = 1 WHERE question_id = ?`
  ).bind(id).run();
  if (!res.meta.changes) return c.json({ error: "bildirim bulunamadı" }, 404);

  return c.json({ ok: true, question_id: id, action });
});

/** Bir alandaki denetlenmemiş soruları kanun metnine karşı denetler. */
hmgs.post("/verify", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB yok" }, 503);
  if (!c.env.DEEPSEEK_API_KEY) return c.json({ error: "DEEPSEEK_API_KEY yok" }, 503);

  let body: { subject?: string; limit?: number; recheck?: boolean; scope?: string; before?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const subject = getSubject(String(body.subject ?? ""));
  if (!subject) return c.json({ error: "geçersiz subject" }, 400);

  // Aynı anda çok soru göndermek hakemi sulandırıyor; küçük parti tut.
  const limit = Math.min(Math.max(Number(body.limit ?? 5), 1), 8);

  // scope:
  //   "new"         (varsayılan) hiç denetlenmemişler
  //   "unsupported" eski recheck=1 — "kaynakta doğrulanamadı" damgalılar.
  //                 Çoğu kötü soru değil, hakemin doğru maddeyi görememesiydi.
  //   "verified"    ONAYLI olanları yeniden denetle. Hakeme "çeldirici de
  //                 doğru olabilir mi?" görevi sonradan eklendi; ondan önce
  //                 onaylanan sorular bu kontrolden hiç geçmedi.
  const scope = body.recheck === true ? "unsupported" : String(body.scope ?? "new");

  // "verified" turunun bitebilmesi için: yalnızca `before`dan ESKİ denetimler
  // seçiliyor. Yeniden denetlenen sorunun checked_at'i şimdiye çekildiğinden
  // seçimden düşüyor, aksi hâlde döngü aynı soruları sonsuza dek çevirirdi.
  const before = Number(body.before) || Date.now();

  const SQL: Record<string, string> = {
    // `checked_at < ?` koruması BURADA DA gerekli. Yoksa kaynaksız kalan soru
    // her turda yeniden seçilir: denetlenir, yine "unsupported" çıkar,
    // verified 0 kaldığı için tekrar seçilir. Döngü kendini bitiremez ve
    // aynı sorulara sonsuza dek para harcanır — ölçüldü, kaynaksız sayısı
    // iki ayrı ölçümde 113'te çakılı kalırken işler dönmeye devam ediyordu.
    unsupported: `SELECT q.id, q.question, q.options, q.correct_answer, q.explanation, q.subtopic
                    FROM hmgs_questions q
                    JOIN hmgs_verdicts v ON v.question_id = q.id
                   WHERE q.subject = ? AND v.verified = 0 AND v.checked_at < ?
                   LIMIT ?`,
    verified: `SELECT q.id, q.question, q.options, q.correct_answer, q.explanation, q.subtopic
                 FROM hmgs_questions q
                 JOIN hmgs_verdicts v ON v.question_id = q.id
                WHERE q.subject = ? AND v.verdict = 'correct' AND v.checked_at < ?
                LIMIT ?`,
    new: `SELECT q.id, q.question, q.options, q.correct_answer, q.explanation, q.subtopic
            FROM hmgs_questions q
            LEFT JOIN hmgs_verdicts v ON v.question_id = q.id
           WHERE q.subject = ? AND v.question_id IS NULL
           LIMIT ?`,
  };
  if (!SQL[scope]) return c.json({ error: "geçersiz scope" }, 400);

  // "new" dışındaki iki kip de zaten denetlenmiş satırlara bakıyor ve
  // `before` koruması olmadan kendini bitiremiyor.
  const zamanli = scope === "verified" || scope === "unsupported";
  const selStmt = c.env.DB.prepare(SQL[scope]);
  const rows = await (zamanli
    ? selStmt.bind(subject.id, before, limit)
    : selStmt.bind(subject.id, limit)
  ).all<any>();

  if (rows.results.length === 0) {
    return c.json({ ok: true, subject: subject.id, checked: 0, remaining: 0 });
  }

  const questions: QuestionToCheck[] = rows.results.map((r) => ({
    id: r.id,
    question: r.question,
    options: JSON.parse(r.options),
    correctAnswer: r.correct_answer,
    explanation: r.explanation,
    // Doktrin konusu kanunda düzenlenmemiş; denetleyici hangi korpustan
    // doğrulayacağını buna bakarak seçiyor.
    subtopic: r.subtopic ?? null,
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
      //
      // ambiguous = -2. NEDEN NEGATİF: havuz sorguları (/exam, /review) sınırı
      // `verified >= 0` diye çekiyor; birden fazla şıkkı doğru olan soruyu
      // sormak çalışmayı bozar (kullanıcı doğru şıkkı işaretleyip yanlış sayılır),
      // o yüzden havuza GİRMEMELİ.
      // NEDEN -1 DEĞİL: ayrı sayı, ayrı kusur. wrong = cevap yanlış, düzeltilmesi
      // şıkkı değiştirmeyi gerektirir; ambiguous = cevap doğru ama çeldirici de
      // doğru, düzeltmesi çeldiriciyi değiştirmek. İkisini aynı kutuya atarsak
      // /verify-stats bunları ayıramaz ve düzeltme işi kör kalır.
      // recheck=1 akışı `verified = 0` seçtiği için ambiguous'u yeniden denemez;
      // kasıtlı — bu retrieval eksikliği değil, doğrulanmış soru kusuru.
      stmt.bind(
        v.id,
        v.verdict === "correct" ? 1
          : v.verdict === "unsupported" ? 0
          : v.verdict === "ambiguous" ? -2
          : -1,
        v.verdict,
        v.reason,
        now
      )
    )
  );

  // Kalan sayısı seçim sorgusuyla AYNI ölçüte bakmalı; yoksa çağıran taraf
  // "remaining: 0" görüp turu erken kapatır.
  const LEFT_SQL: Record<string, string> = {
    unsupported: `SELECT COUNT(*) as n FROM hmgs_questions q
                    JOIN hmgs_verdicts v ON v.question_id = q.id
                   WHERE q.subject = ? AND v.verified = 0 AND v.checked_at < ?`,
    verified: `SELECT COUNT(*) as n FROM hmgs_questions q
                 JOIN hmgs_verdicts v ON v.question_id = q.id
                WHERE q.subject = ? AND v.verdict = 'correct' AND v.checked_at < ?`,
    new: `SELECT COUNT(*) as n FROM hmgs_questions q
            LEFT JOIN hmgs_verdicts v ON v.question_id = q.id
           WHERE q.subject = ? AND v.question_id IS NULL`,
  };
  const leftStmt = c.env.DB.prepare(LEFT_SQL[scope]);
  const left = await (zamanli
    ? leftStmt.bind(subject.id, before)
    : leftStmt.bind(subject.id)
  ).first<{ n: number }>();

  return c.json({
    ok: true,
    subject: subject.id,
    scope,
    checked: verdicts.length,
    remaining: left?.n ?? 0,
    verdicts,
  });
});

/**
 * Etiketsiz soruları alt konuya atar (geriye dönük doldurma).
 *
 * subtopic sütunu sonradan eklendi; ondan önceki ~3000 soruda bilgi yok.
 */
hmgs.post("/classify", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB yok" }, 503);
  if (!c.env.DEEPSEEK_API_KEY) return c.json({ error: "DEEPSEEK_API_KEY yok" }, 503);

  let body: { subject?: string; limit?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const subject = getSubject(String(body.subject ?? ""));
  if (!subject) return c.json({ error: "geçersiz subject" }, 400);
  const limit = Math.min(Math.max(Number(body.limit ?? 20), 1), 40);

  const rows = await c.env.DB.prepare(
    `SELECT id, question, explanation FROM hmgs_questions
      WHERE subject = ? AND subtopic IS NULL LIMIT ?`
  ).bind(subject.id, limit).all<{ id: string; question: string; explanation: string }>();

  if (rows.results.length === 0) {
    return c.json({ ok: true, subject: subject.id, labeled: 0, remaining: 0 });
  }

  const atamalar = await classifyQuestions(
    c.env.DEEPSEEK_API_KEY,
    subject,
    rows.results
  );

  if (atamalar.length > 0) {
    const stmt = c.env.DB.prepare(
      `UPDATE hmgs_questions SET subtopic = ? WHERE id = ?`
    );
    await c.env.DB.batch(atamalar.map((a) => stmt.bind(a.subtopic, a.id)));
  }

  const left = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM hmgs_questions WHERE subject = ? AND subtopic IS NULL`
  ).bind(subject.id).first<{ n: number }>();

  return c.json({
    ok: true,
    subject: subject.id,
    seen: rows.results.length,
    labeled: atamalar.length,
    remaining: left?.n ?? 0,
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

/**
 * Bir alanın anlatılabilir alt konuları: kanun konuları + doktrin konuları.
 *
 * İkisi tek listede birleşiyor çünkü kullanıcı açısından ayrım yok — "hizmet
 * kusuru" da "kamulaştırma usulü" de İdare Hukuku'nun bir konusu. Ayrım
 * yalnızca retrieval'ın hangi korpusa gideceğini belirliyor ve orası
 * generateTopic'in içinde kalıyor.
 */
function allSubtopics(s: { subtopics?: string[]; doctrineSubtopics?: string[] }): string[] {
  return [...(s.subtopics ?? []), ...(s.doctrineSubtopics ?? [])];
}

/**
 * Alt konu anlatımı. Önbellekte varsa oradan, yoksa üretip yazar.
 *
 * subtopic İSTEMCİDEN GELEN SERBEST METİNLE ÇALIŞMAZ: alanın kendi listesinde
 * geçmiyorsa 400. Gerekçe, /report'ta subject'i istemciden almamakla aynı —
 * doğrulanmamış girdiyle üretim tetiklemek hem para harcatır hem de bankaya
 * (burada önbelleğe) alanla ilgisiz kayıt açar.
 */
hmgs.post("/topic", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB yok" }, 503);

  let body: { subject?: string; subtopic?: string; refresh?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const subject = getSubject(String(body.subject ?? ""));
  if (!subject) return c.json({ error: "geçersiz subject" }, 400);

  const subtopic = String(body.subtopic ?? "");
  if (!allSubtopics(subject).includes(subtopic)) {
    return c.json({ error: "geçersiz subtopic" }, 400);
  }

  // Önbellek. refresh=true ise hiç bakılmıyor — kullanıcı bilerek yeniden
  // üretmek istiyor (anlatım kötü çıkmış olabilir).
  if (body.refresh !== true) {
    const hit = await c.env.DB.prepare(
      `SELECT content, sources FROM hmgs_topics WHERE subject = ? AND subtopic = ?`
    ).bind(subject.id, subtopic).first<{ content: string; sources: string }>();

    if (hit) {
      return c.json({
        ok: true,
        subject: subject.id,
        subtopic,
        subject_name: subject.name,
        content: hit.content,
        sources: JSON.parse(hit.sources),
        cached: true,
      });
    }
  }

  // Üretim buradan sonra; anahtar kontrolü de buraya kadar ertelendi ki
  // önbellekteki anlatım anahtar olmadan da okunabilsin.
  if (!c.env.DEEPSEEK_API_KEY) {
    return c.json({ error: "DEEPSEEK_API_KEY tanımlı değil" }, 503);
  }

  const topic = await generateTopic(
    { AI: c.env.AI, VECTORIZE: c.env.VECTORIZE, DB: c.env.DB, DEEPSEEK_API_KEY: c.env.DEEPSEEK_API_KEY },
    subject,
    subtopic
  );

  if (!topic) {
    return c.json({ error: "konu anlatımı üretilemedi (kaynak metin bulunamadı)" }, 502);
  }

  // INSERT OR REPLACE: refresh akışında eski satır üzerine yazılsın.
  await c.env.DB.prepare(
    `INSERT OR REPLACE INTO hmgs_topics (subject, subtopic, content, sources, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(
    subject.id,
    subtopic,
    topic.content,
    JSON.stringify(topic.sources),
    Date.now()
  ).run();

  return c.json({
    ok: true,
    subject: subject.id,
    subtopic,
    subject_name: subject.name,
    content: topic.content,
    sources: topic.sources,
    cached: false,
  });
});

/**
 * Anlatım menüsü: tüm alanlar, alt konuları ve o konunun hazır olup olmadığı.
 *
 * ready, arayüzün "bu konu anında açılır mı yoksa üretim mi bekleyeceksin"
 * ayrımını yapabilmesi için — üretim saniyeler sürüyor, kullanıcı tıklamadan
 * önce bilsin.
 */
hmgs.get("/topics", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB yok" }, 503);

  // Tek sorgu, alan başına sorgu değil: 20 alan × ~8 alt konu için 157 sorgu
  // atmanın anlamı yok, tablonun tamamı zaten bu kadar satır.
  const rows = await c.env.DB.prepare(
    `SELECT subject, subtopic FROM hmgs_topics`
  ).all<{ subject: string; subtopic: string }>();

  // Ayraç olarak satır sonu: alt konu adlarında boşluk var, kayıt anahtarının
  // iki alanı birbirine karışmasın.
  const ready = new Set(rows.results.map((r) => `${r.subject}\n${r.subtopic}`));

  return c.json({
    subjects: HMGS_SUBJECTS.map((s) => ({
      id: s.id,
      name: s.name,
      subtopics: allSubtopics(s).map((name) => ({
        name,
        ready: ready.has(`${s.id}\n${name}`),
      })),
    })),
  });
});
