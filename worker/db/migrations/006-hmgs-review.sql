-- Yanlış cevaplanan HMGS sorularının tekrar kuyruğu.
--
-- flashcard_state yeniden kullanılmadı: orası card_id + course üzerine kurulu,
-- soru id'sini oraya sahte bir course ile sokmak iki akışı birbirine bağlardı.
-- Sütun adları srs.ts'teki StoredSrs ile birebir aynı, dönüşüm gerekmiyor.

CREATE TABLE IF NOT EXISTS hmgs_review (
  question_id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  next_review INTEGER NOT NULL,   -- unix ms
  stability REAL,
  difficulty REAL,
  elapsed_days INTEGER,
  scheduled_days INTEGER,
  reps INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  fsrs_state INTEGER NOT NULL DEFAULT 0,
  last_review INTEGER,
  added_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hmgs_review_due ON hmgs_review(next_review);
CREATE INDEX IF NOT EXISTS idx_hmgs_review_subject ON hmgs_review(subject);
