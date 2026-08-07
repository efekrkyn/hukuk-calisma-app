import type { FormInput, AiOutput } from "./plan-schemas";
import { HMGS_SUBJECTS } from "./hmgs-subjects";

export type StoredPlan = {
  id: string;
  form_input: FormInput;
  ai_output: AiOutput;
  ai_model: string;
  generated_at: number;
  is_active: number;
};

export type PlanRow = {
  id: string;
  form_input: string;
  ai_output: string;
  ai_model: string;
  generated_at: number;
  is_active: number;
};

/**
 * Bir alanı "zayıf" ilan etmek için gereken en az cevap sayısı.
 *
 * 2 soruda 1 yanlış %50 doğruluk demek ama hiçbir şey ölçmüyor; bu eşik
 * olmadan plan, kullanıcının şans eseri kaçırdığı alana en çok saati verir.
 * hmgs.ts'teki /performance ile aynı sayı (5) — iki yer aynı alana "zayıf"
 * demeli, yoksa panel ile plan çelişir.
 */
export const MIN_SUBJECT_ANSWERS = 5;

/**
 * Alt konu eşiği daha düşük: bir alanın 7-10 alt konusu var, cevaplar oraya
 * bölününce alan eşiğini (5) beklemek 40+ cevaba kadar hiçbir alt konunun
 * görünmemesi demek. 3, "tesadüf" ile "eğilim" arasındaki en ucuz sınır.
 */
export const MIN_SUBTOPIC_ANSWERS = 3;

/** Alt konu başına en fazla kaç zayıf kayıt isteme gireceği — istem şişmesin. */
const MAX_WEAK_SUBTOPICS = 3;

export type SubjectStat = {
  id: string;
  answered: number;
  correct: number;
  /** Eşiğin altındaysa null — "veri yok" ile "kötü" karıştırılmasın. */
  accuracy: number | null;
  weak_subtopics: Array<{ name: string; answered: number; accuracy: number }>;
};

export type StudyStats = {
  subjects: SubjectStat[];
  /** Tekrar kuyruğunda vakti gelmiş soru sayısı. */
  review_due: number;
};

function parseRow(row: PlanRow): StoredPlan {
  return {
    id: row.id,
    form_input: JSON.parse(row.form_input) as FormInput,
    ai_output: JSON.parse(row.ai_output) as AiOutput,
    ai_model: row.ai_model,
    generated_at: row.generated_at,
    is_active: row.is_active,
  };
}

export async function getActivePlan(db: D1Database): Promise<StoredPlan | null> {
  const r = await db
    .prepare(`SELECT * FROM study_plans WHERE is_active = 1 ORDER BY generated_at DESC LIMIT 1`)
    .first<PlanRow>();
  return r ? parseRow(r) : null;
}

export async function getPlanById(
  db: D1Database,
  id: string
): Promise<StoredPlan | null> {
  const r = await db
    .prepare(`SELECT * FROM study_plans WHERE id = ?`)
    .bind(id)
    .first<PlanRow>();
  return r ? parseRow(r) : null;
}

export async function insertPlan(
  db: D1Database,
  args: {
    id: string;
    form_input: FormInput;
    ai_output: AiOutput;
    ai_model: string;
  }
): Promise<void> {
  // Yeni plan eklenirken eskiler arşivleniyor
  await db.batch([
    db.prepare(`UPDATE study_plans SET is_active = 0`),
    db.prepare(
      `INSERT INTO study_plans (id, form_input, ai_output, ai_model, generated_at, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`
    ).bind(
      args.id,
      JSON.stringify(args.form_input),
      JSON.stringify(args.ai_output),
      args.ai_model,
      Date.now()
    ),
  ]);
}

/**
 * Planın besleneceği zayıflık verisi.
 *
 * Eskiden `practice_responses` okunuyordu; o tablo ölü, uygulamanın gerçek
 * cevap kaydı `hmgs_attempts`. Alan doğruluğu oradan, alt konu doğruluğu
 * `hmgs_questions.subtopic` ile join'den geliyor.
 */
export async function fetchStudyStats(db: D1Database): Promise<StudyStats> {
  const now = Date.now();
  const [bySubject, bySubtopic, due] = await Promise.all([
    db
      .prepare(
        `SELECT subject, COUNT(*) AS n, SUM(is_correct) AS dogru
           FROM hmgs_attempts GROUP BY subject`
      )
      .all<{ subject: string; n: number; dogru: number }>(),
    db
      .prepare(
        // subtopic 009 migration'ıyla geldi, eski sorularda NULL. Join'de
        // eleniyor: NULL alt konu "bilinmeyen konu" grubu üretir, plana
        // yazılabilecek bir ad değil.
        `SELECT q.subject AS subject, q.subtopic AS subtopic,
                COUNT(*) AS n, SUM(a.is_correct) AS dogru
           FROM hmgs_attempts a
           JOIN hmgs_questions q ON q.id = a.question_id
          WHERE q.subtopic IS NOT NULL AND q.subtopic <> ''
          GROUP BY q.subject, q.subtopic`
      )
      .all<{ subject: string; subtopic: string; n: number; dogru: number }>(),
    db
      .prepare(
        // Ölçüt /tekrar'ı besleyen sorguyla aynı: bildirilmiş veya denetimden
        // geçmemiş soru kuyrukta görünmüyor, sayaç da onları saymamalı —
        // yoksa plan "40 soru tekrar et" der, kuyrukta 12 soru çıkar.
        `SELECT COUNT(*) AS n
           FROM hmgs_review r
           JOIN hmgs_verdicts v ON v.question_id = r.question_id
           LEFT JOIN hmgs_reports rp ON rp.question_id = r.question_id AND rp.resolved = 0
          WHERE r.next_review <= ? AND v.verified = 1 AND rp.question_id IS NULL`
      )
      .bind(now)
      .first<{ n: number }>(),
  ]);

  const weakBySubject = new Map<string, SubjectStat["weak_subtopics"]>();
  for (const r of bySubtopic.results) {
    if (r.n < MIN_SUBTOPIC_ANSWERS) continue;
    const list = weakBySubject.get(r.subject) ?? [];
    list.push({
      name: r.subtopic,
      answered: r.n,
      accuracy: Math.round((r.dogru / r.n) * 100),
    });
    weakBySubject.set(r.subject, list);
  }

  const known = new Set(HMGS_SUBJECTS.map((s) => s.id));
  const subjects: SubjectStat[] = [];
  for (const r of bySubject.results) {
    // Eski/başıboş alan id'leri plana taşınmasın; plan yalnızca 20 alanı bilir.
    if (!known.has(r.subject)) continue;
    subjects.push({
      id: r.subject,
      answered: r.n,
      correct: r.dogru,
      accuracy: r.n >= MIN_SUBJECT_ANSWERS ? Math.round((r.dogru / r.n) * 100) : null,
      weak_subtopics: (weakBySubject.get(r.subject) ?? [])
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, MAX_WEAK_SUBTOPICS),
    });
  }

  return { subjects, review_due: due?.n ?? 0 };
}

/**
 * Önceki planın ne kadarının tiklendiği.
 *
 * Eski `fetchTickHistory` 50 uuid'i boş `course` alanıyla isteme yazıyordu —
 * model bundan hiçbir şey çıkaramazdı. Tek işe yarar sinyal orandır: geçen
 * planın %20'si yapıldıysa yeni plan daha az görev içermeli.
 */
export async function fetchPlanProgress(
  db: D1Database,
  plan: StoredPlan
): Promise<{ planned: number; done: number }> {
  const planned = plan.ai_output.weeks.reduce(
    (a, w) => a + w.days.reduce((b, d) => b + d.tasks.length, 0),
    0
  );
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM study_task_completions WHERE plan_id = ?`)
    .bind(plan.id)
    .first<{ n: number }>();
  return { planned, done: row?.n ?? 0 };
}

export async function setCompletion(
  db: D1Database,
  args: { task_uuid: string; plan_id: string; completed: boolean }
): Promise<void> {
  if (args.completed) {
    await db
      .prepare(
        `INSERT OR REPLACE INTO study_task_completions (task_uuid, plan_id, completed_at)
         VALUES (?, ?, ?)`
      )
      .bind(args.task_uuid, args.plan_id, Date.now())
      .run();
  } else {
    await db
      .prepare(`DELETE FROM study_task_completions WHERE task_uuid = ?`)
      .bind(args.task_uuid)
      .run();
  }
}

export async function fetchCompletions(
  db: D1Database,
  planId: string
): Promise<Record<string, number>> {
  const rows = await db
    .prepare(
      `SELECT task_uuid, completed_at FROM study_task_completions WHERE plan_id = ?`
    )
    .bind(planId)
    .all<{ task_uuid: string; completed_at: number }>();
  const map: Record<string, number> = {};
  for (const r of rows.results) map[r.task_uuid] = r.completed_at;
  return map;
}
