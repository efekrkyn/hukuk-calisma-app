import { z } from "zod";

export const FormInputSchema = z.object({
  target_exam: z.enum(["final", "hmgs", "both"]),
  exam_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weeks_remaining: z.number().int().min(1).max(52),
  weekly_hours_weekday: z.number().min(0).max(12),
  weekly_hours_weekend: z.number().min(0).max(12),
  study_window_start: z.string().regex(/^\d{2}:\d{2}$/),
  study_window_end: z.string().regex(/^\d{2}:\d{2}$/),
  weak_courses: z.array(z.string()).max(21),
  notes: z.string().max(2000).default(""),
});

export type FormInput = z.infer<typeof FormInputSchema>;

const TaskSchema = z.object({
  uuid: z.string().min(8),
  time_start: z.string().regex(/^\d{2}:\d{2}$/),
  time_end: z.string().regex(/^\d{2}:\d{2}$/),
  course: z.string(),
  topic: z.string(),
  task_type: z.enum(["read", "practice", "review"]),
  target_ref: z.string().nullable().optional(),
  tip: z.string().nullable().optional(),
});

const DaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekday: z.string(),
  tasks: z.array(TaskSchema),
});

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

export const PracticeStatsSchema = z.array(
  z.object({
    course: z.string(),
    avg_score: z.number(),
    case_count: z.number().int(),
  })
);

export type PracticeStats = z.infer<typeof PracticeStatsSchema>;

export const TickHistorySchema = z.array(
  z.object({
    task_uuid: z.string(),
    course: z.string(),
    completed_at: z.number().int(),
  })
);

export type TickHistory = z.infer<typeof TickHistorySchema>;
