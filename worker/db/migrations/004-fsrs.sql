-- Flashcard tekrarını FSRS'e taşı.
--
-- Eski şema basitleştirilmiş SM-2 idi (ease + interval_days): hafızayı tek
-- çarpanla modelliyordu. FSRS stabilite ve zorluğu ayrı tutuyor, bu yüzden
-- aynı kartı farklı geçmişlerle farklı zamanlarda çıkarabiliyor.
--
-- Eski sütunlar (ease, interval_days, streak) DÜŞÜRÜLMÜYOR: D1'de sütun
-- düşürmek tabloyu yeniden yazmayı gerektiriyor ve eski veri elde kalsın
-- ki geri dönmek gerekirse kaybolmasın.

ALTER TABLE flashcard_state ADD COLUMN stability REAL;
ALTER TABLE flashcard_state ADD COLUMN difficulty REAL;
ALTER TABLE flashcard_state ADD COLUMN elapsed_days INTEGER DEFAULT 0;
ALTER TABLE flashcard_state ADD COLUMN scheduled_days INTEGER DEFAULT 0;
ALTER TABLE flashcard_state ADD COLUMN reps INTEGER DEFAULT 0;
ALTER TABLE flashcard_state ADD COLUMN lapses INTEGER DEFAULT 0;
-- FSRS kart durumu: 0=New 1=Learning 2=Review 3=Relearning
ALTER TABLE flashcard_state ADD COLUMN fsrs_state INTEGER DEFAULT 0;
ALTER TABLE flashcard_state ADD COLUMN last_review INTEGER;

CREATE INDEX IF NOT EXISTS idx_flashcard_due ON flashcard_state(next_review);
