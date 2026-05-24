-- Hukuk Çalışma Uygulaması — D1 Schema v1
-- Apply: wrangler d1 execute hukuk-db --local --file=db/schema.sql
--        wrangler d1 execute hukuk-db --remote --file=db/schema.sql

-- Quiz attempts
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  course TEXT NOT NULL,
  topic TEXT,
  question_id TEXT NOT NULL,
  selected_answer INTEGER NOT NULL,
  is_correct INTEGER NOT NULL,    -- 0/1
  created_at INTEGER NOT NULL     -- unix ms
);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_course ON quiz_attempts(course);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_ts ON quiz_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_question ON quiz_attempts(question_id);

-- Flashcard SRS state
CREATE TABLE IF NOT EXISTS flashcard_state (
  card_id TEXT PRIMARY KEY,
  course TEXT NOT NULL,
  ease REAL NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 0,
  next_review INTEGER NOT NULL,   -- unix ms
  last_seen INTEGER,
  streak INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_flashcard_next ON flashcard_state(next_review);
CREATE INDEX IF NOT EXISTS idx_flashcard_course ON flashcard_state(course);

-- AI chat history
CREATE TABLE IF NOT EXISTS chat_history (
  id TEXT PRIMARY KEY,
  course TEXT,
  pdf_key TEXT,
  selected_text TEXT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sources TEXT,                   -- JSON array
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_course ON chat_history(course);
CREATE INDEX IF NOT EXISTS idx_chat_ts ON chat_history(created_at);

-- Study plan
CREATE TABLE IF NOT EXISTS study_plan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,             -- YYYY-MM-DD
  course TEXT NOT NULL,
  topic TEXT,
  target_min INTEGER NOT NULL,
  actual_min INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_plan_date ON study_plan(date);
CREATE INDEX IF NOT EXISTS idx_plan_course ON study_plan(course);

-- Pomodoro sessions
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id TEXT PRIMARY KEY,
  course TEXT,
  duration_min INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_pomodoro_started ON pomodoro_sessions(started_at);

-- Practice case responses (Modül 5)
CREATE TABLE IF NOT EXISTS practice_responses (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  user_solution TEXT NOT NULL,
  ai_feedback TEXT NOT NULL,
  score INTEGER,                  -- 0-100
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_practice_case ON practice_responses(case_id);
