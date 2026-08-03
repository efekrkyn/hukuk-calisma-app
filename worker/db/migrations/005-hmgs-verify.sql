-- Soru bankası denetimi.
--
-- Sorular kanun metninden üretiliyor ama hukuki doğrulukları denetlenmemişti;
-- 5510 örneğinde açıklama kendi kendisiyle çelişiyordu (m.80(b)'deki tutarın
-- prime esas kazanca dahil OLMADIĞINI söyleyip "dahildir" diye işaretliyordu).
--
-- verified:  0 = denetlenmedi (varsayılan)
--            1 = kaynak metin cevabı destekliyor
--           -1 = cevap yanlış veya kaynakta karşılığı yok
CREATE TABLE IF NOT EXISTS hmgs_verdicts (
  question_id TEXT PRIMARY KEY,
  verified INTEGER NOT NULL,
  verdict TEXT NOT NULL,        -- correct | wrong | unsupported
  reason TEXT,
  checked_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hmgs_verdicts_v ON hmgs_verdicts(verified);
