// frontend/types/plan.ts
// Worker plan-schemas.ts ile birebir senkron — değiştirirsen iki yeri de güncelle.

export type FormInput = {
  target_exam: "final" | "hmgs" | "both";
  exam_date: string;
  weeks_remaining: number;
  weekly_hours_weekday: number;
  weekly_hours_weekend: number;
  study_window_start: string;
  study_window_end: string;
  break_minutes: number;
  weak_courses: string[];
  notes: string;
};

export type Task = {
  uuid: string;
  time_start: string;
  time_end: string;
  course: string;
  topic: string;
  task_type: "read" | "practice" | "review";
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

export type AiOutput = {
  summary: string;
  weeks: Week[];
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
};
