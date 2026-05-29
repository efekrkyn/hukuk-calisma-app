-- worker/db/migrations/002-study-plans.sql
-- AI Çalışma Programı Üreticisi — 2026-05-25

CREATE TABLE IF NOT EXISTS study_plans (
  id TEXT PRIMARY KEY,
  form_input TEXT NOT NULL,
  ai_output TEXT NOT NULL,
  ai_model TEXT NOT NULL,
  generated_at INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_study_plans_active
  ON study_plans(is_active, generated_at DESC);

CREATE TABLE IF NOT EXISTS study_task_completions (
  task_uuid TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  completed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_study_task_plan
  ON study_task_completions(plan_id);
