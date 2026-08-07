import { z } from "zod";

/**
 * Çalışma planı şemaları — HMGS sürümü.
 *
 * Ders listesi kullanıcıdan alınmıyor: HMGS'nin 20 alanı ve her alanın
 * sınavdaki soru sayısı sabit (bkz. hmgs-subjects.ts). Kullanıcıdan yalnızca
 * takvimi kuran şeyler isteniyor — sınav tarihi, günlük saat, çalışma
 * penceresi, tatil günleri.
 */

/** Plan çıktısındaki `weekday` ile birebir aynı yazım; eşleştirme dönüşümsüz olsun. */
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

export const FormInputSchema = z.object({
  /** Tek HMGS tarihi. Ders başına final tarihi kavramı kalktı. */
  exam_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  daily_hours: z.number().min(0.5).max(14),
  study_window_start: z.string().regex(/^\d{2}:\d{2}$/),
  study_window_end: z.string().regex(/^\d{2}:\d{2}$/),
  break_minutes: z.number().int().min(0).max(120).default(15),
  /** Haftanın boş günleri. 7 gün de boşsa plan diye bir şey kalmıyor, o yüzden en fazla 6. */
  days_off: z.array(z.enum(WEEKDAYS)).max(6).default([]),
  notes: z.string().max(2000).default(""),
});

export type FormInput = z.infer<typeof FormInputSchema>;

/**
 * Görev türleri — her biri uygulamada gerçekten var olan bir eyleme karşılık
 * gelir ve `target_ref` bu türden deterministik üretilir (plan-validate.ts).
 *
 * `serbest`: kullanıcının plana elle eklediği görev. Hedefi yok, olması da
 * gerekmiyor; ayrı bir tür olması sayesinde "hedefi boş olabilen görev"
 * istisnası doğrulayıcıya sızmıyor.
 */
export const TASK_TYPES = ["konu", "soru", "tekrar", "deneme", "serbest"] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export const TaskSchema = z.object({
  uuid: z.string().min(8),
  time_start: z.string().regex(/^\d{2}:\d{2}$/),
  time_end: z.string().regex(/^\d{2}:\d{2}$/),
  /** HMGS alan id'si. tekrar/deneme/serbest görevlerinde null. */
  subject: z.string().nullable().default(null),
  topic: z.string(),
  task_type: z.enum(TASK_TYPES),
  target_ref: z.string().nullable().default(null),
  tip: z.string().nullable().default(null),
});

export type Task = z.infer<typeof TaskSchema>;

const DaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekday: z.string(),
  tasks: z.array(TaskSchema),
});

export type Day = z.infer<typeof DaySchema>;

const WeekSchema = z.object({
  week_index: z.number().int().min(1),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.array(DaySchema),
});

export const AiOutputSchema = z.object({
  summary: z.string().min(1),
  weeks: z.array(WeekSchema).min(1),
});

export type AiOutput = z.infer<typeof AiOutputSchema>;
