-- Kullanıcının "bu soru hatalı" bildirimleri.
--
-- Sorular kanun metninden yapay zekâ ile üretiliyor; hmgs_verdicts'teki makine
-- denetimi ikinci bir modelin görüşü, insan onayı değil. Uygulamayı yazan kişinin
-- hukuk bilgisi soruları teyit etmeye yetmiyor — gerçek geri bildirim sınava
-- hazırlanan kullanıcıdan gelir ve şimdiye kadar bunu iletecek bir kanal yoktu.
--
-- Bildirilen soru, sahibi karara varana kadar denemeden ve tekrar kuyruğundan
-- düşer: şüpheli soruyu sormaya devam etmek çalışmayı bozar.
--
-- question_id UNIQUE: aynı soru için ikinci bildirim yeni satır açmaz, mevcut
-- kaydı tazeler. Gerekçe — bu tek kullanıcılık bir uygulama, aynı sorunun N kez
-- bildirilmesi sahibe yeni bilgi vermez; N satır ise inceleme listesinde tekrar
-- üretir ve "çözüldü" işaretini satır satır dolaştırmayı gerektirir. Soru başına
-- tek satırda karar tek yerde verilir. UNIQUE kısıtı question_id araması için
-- zaten bir index yarattığından ayrıca index açılmadı.
--
-- resolved: 0 = sahibi henüz bakmadı · 1 = karar verildi (soru tutuldu).
-- "Sil" kararında satır zaten soruyla birlikte siliniyor.

CREATE TABLE IF NOT EXISTS hmgs_reports (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  reason TEXT,                        -- kullanıcının serbest metni, boş olabilir
  created_at INTEGER NOT NULL,        -- unix ms — son bildirimin zamanı
  resolved INTEGER NOT NULL DEFAULT 0
);

-- Açık bildirimleri listelemek ve havuz sorgularında elemek için.
CREATE INDEX IF NOT EXISTS idx_hmgs_reports_resolved ON hmgs_reports(resolved);
