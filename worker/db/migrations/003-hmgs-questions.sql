-- HMGS soru bankası.
--
-- Sorular ÖSYM kitapçıklarından KOPYALANMAZ (kitapçıklar telifli); indexlenmiş
-- kanun metinlerinden RAG ile üretilir. source_pdf/source_page hangi kanun
-- maddesine dayandığını tutar, böylece üretilen soru denetlenebilir.

CREATE TABLE IF NOT EXISTS hmgs_questions (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,          -- HMGS_SUBJECTS içindeki id
  question TEXT NOT NULL,
  options TEXT NOT NULL,          -- JSON string[]  (4 şık)
  correct_answer INTEGER NOT NULL,-- 0-3
  explanation TEXT NOT NULL,
  source_pdf TEXT,                -- dayandığı R2 key
  source_page INTEGER,
  created_at INTEGER NOT NULL     -- unix ms
);
CREATE INDEX IF NOT EXISTS idx_hmgs_q_subject ON hmgs_questions(subject);
CREATE INDEX IF NOT EXISTS idx_hmgs_q_ts ON hmgs_questions(created_at);

-- Deneme sonuçları
CREATE TABLE IF NOT EXISTS hmgs_attempts (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  selected_answer INTEGER,        -- NULL = boş bırakıldı
  is_correct INTEGER NOT NULL,    -- 0/1
  exam_id TEXT NOT NULL,          -- aynı denemenin soruları
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hmgs_a_exam ON hmgs_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_hmgs_a_subject ON hmgs_attempts(subject);
