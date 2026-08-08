// frontend/types/plan.ts
// Worker plan-schemas.ts ile birebir senkron — değiştirirsen iki yeri de güncelle.

export const WEEKDAYS = [
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
  "Pazar",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export type FormInput = {
  /** Tek HMGS tarihi — ders başına final tarihi kavramı kalktı. */
  exam_date: string;
  daily_hours: number;
  study_window_start: string;
  study_window_end: string;
  break_minutes: number;
  days_off: Weekday[];
  notes: string;
};

/** Her tür uygulamada gerçekten var olan bir sayfaya gider; `serbest` elle eklenen görev. */
export type TaskType = "konu" | "soru" | "tekrar" | "deneme" | "serbest";

export type Task = {
  uuid: string;
  time_start: string;
  time_end: string;
  /** HMGS alan id'si; tekrar/deneme/serbest görevlerinde null. */
  subject: string | null;
  topic: string;
  task_type: TaskType;
  /** Worker tarafında üretilir, uygulama içi göreli yol ("hmgs?subject=ceza"). */
  target_ref?: string | null;
  tip?: string | null;
};

export type Day = {
  date: string;
  weekday: string;
  tasks: Task[];
};

export type Week = {
  week_index: number;
  start_date: string;
  end_date: string;
  days: Day[];
};

/**
 * Ayrıntılı plandan sonraki haftaların kaba dökümü.
 *
 * Modelden gelmiyor, worker'da deterministik üretiliyor: saat dağıtımı zaten
 * alan ağırlığı × zayıflık ile hesaplanıyor. Eski planlarda yok, o yüzden
 * isteğe bağlı.
 */
export type OutlookWeek = {
  week_index: number;
  start_date: string;
  end_date: string;
  focus: Array<{ id: string; name: string; hours: number }>;
  mock_exams: number;
  phase: string;
  /** Alan çalışmasına kalan saat (deneme süresi düşülmüş). */
  study_hours?: number;
  mix?: string;
};

export type AiOutput = {
  summary: string;
  weeks: Week[];
  outlook?: OutlookWeek[];
};

export type StoredPlan = {
  id: string;
  form_input: FormInput;
  ai_output: AiOutput;
  ai_model: string;
  generated_at: number;
  is_active: number;
};

export type ActivePlanResponse = {
  plan: StoredPlan | null;
  completions: Record<string, number>;
};

export type GenerateResponse = {
  plan_id: string;
  ai_output: AiOutput;
  summary: string;
  /** Hedefi doğrulanamadığı için düşen görev sayısı. */
  dropped?: number;
  repaired?: number;
};
