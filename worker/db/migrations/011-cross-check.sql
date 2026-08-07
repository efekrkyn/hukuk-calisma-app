-- İkinci hakem: bağımsız çapraz denetim kayıtları.
--
-- NEDEN AYRI TABLO: hmgs_verdicts'e karışırsa iki hakemin kararı üst üste
-- biner ve "ne kadar uyuşuyorlar" sorusu bir daha sorulamaz. Bu katmanın tek
-- değeri anlaşmazlığı ÖLÇEBİLMEK; ölçüm için iki kararın ayrı ayrı durması şart.
--
-- NEDEN İKİNCİ HAKEM: üretici (deepseek-chat) ile birinci hakem
-- (deepseek-reasoner) aynı model ailesinden. Aynı aile aynı körlüğü paylaşabilir;
-- elle denetlenen 50 soruluk örneklemde bulunan kusurların TAMAMI aynı türdendi
-- (birden fazla şık doğru), yani sistematik bir kör nokta var. Farklı aileden
-- (Gemini) ikinci bir okuma bu körlüğün ortak olup olmadığını gösterir.
--
-- verdict: correct | wrong | unsupported | ambiguous — birinci hakemle aynı
-- karar türleri, yoksa iki sonuç karşılaştırılamaz.
-- model: hangi hakem karar verdi. Model değişince eski kararların hangi
-- sürümden geldiği bilinsin diye kayıtlı.
CREATE TABLE IF NOT EXISTS hmgs_cross_checks (
  question_id TEXT PRIMARY KEY,
  verdict TEXT NOT NULL,
  reason TEXT,
  model TEXT NOT NULL,
  checked_at INTEGER NOT NULL
);

-- Havuz sorguları (/exam, /review) her soru için "bu soru çapraz denetimden
-- düştü mü" diye bakıyor; verdict üzerinden indeks o birleştirmeyi ucuzlatır.
CREATE INDEX IF NOT EXISTS idx_hmgs_cross_verdict ON hmgs_cross_checks(verdict);
