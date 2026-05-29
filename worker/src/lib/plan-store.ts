import type { FormInput, AiOutput, PracticeStats, TickHistory } from "./plan-schemas";

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

export async function fetchPracticeStats(db: D1Database): Promise<PracticeStats> {
  // practice_responses tablosundan course bazlı average + count
  const rows = await db
    .prepare(
      `SELECT
         case_id,
         AVG(score) as avg_score,
         COUNT(*) as case_count
       FROM practice_responses
       GROUP BY case_id`
    )
    .all<{ case_id: string; avg_score: number; case_count: number }>();
  // case_id format: "borc_001" → course = "borclar_ozel" gibi
  // Pratik: case_id prefix → course mapping (manual yapay; veya sadece prefix kullan)
  const byCourse = new Map<string, { sum: number; n: number }>();
  for (const r of rows.results) {
    const prefix = r.case_id ? r.case_id.split("_")[0] : "";
    if (!prefix) continue;
    const cur = byCourse.get(prefix) ?? { sum: 0, n: 0 };
    cur.sum += (r.avg_score ?? 0) * (r.case_count ?? 0);
    cur.n += r.case_count ?? 0;
    byCourse.set(prefix, cur);
  }
  const PREFIX_TO_COURSE: Record<string, string> = {
    borc: "borclar_ozel",
    borcg: "borclar_genel",
    miras: "miras_hukuku",
    esya: "esya_hukuku",
    is: "is_hukuku",
    vergi: "vergi_hukuku",
    ticaret: "ticaret_hukuku",
    kev: "kiymetli_evrak",
    deniz: "deniz_ticareti",
    musul: "medeni_usul",
    icra: "icra_iflas",
    cezag: "ceza_genel",
    cezao: "ceza_ozel",
    cezam: "ceza_muhakemesi",
    idy: "idari_yargilama",
    mlk: "milletlerarasi_kamu",
    mohuk: "milletlerarasi_ozel",
  };
  const out: PracticeStats = [];
  for (const [prefix, { sum, n }] of byCourse.entries()) {
    const course = PREFIX_TO_COURSE[prefix] ?? prefix;
    out.push({
      course,
      avg_score: Math.round(sum / Math.max(n, 1)),
      case_count: n,
    });
  }
  return out;
}

export async function fetchTickHistory(
  db: D1Database,
  planId: string
): Promise<TickHistory> {
  const rows = await db
    .prepare(
      `SELECT task_uuid, completed_at FROM study_task_completions WHERE plan_id = ? ORDER BY completed_at DESC LIMIT 50`
    )
    .bind(planId)
    .all<{ task_uuid: string; completed_at: number }>();
  // course bilgisini plan ai_output'tan çekmek gerek, ama burada plan_id'den çekiliyor
  // Basitlik için course'u kaldırıyoruz; sadece task_uuid + completed_at döner.
  // AI prompt için ham veri yeterli — course tahmin gerekiyorsa ileride parse edilir.
  return rows.results.map((r) => ({
    task_uuid: r.task_uuid,
    course: "",
    completed_at: r.completed_at,
  }));
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
