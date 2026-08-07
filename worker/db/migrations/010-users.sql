-- Çok kullanıcılı hâle geçiş.
--
-- NEDEN ŞİMDİ: Uygulamayı yazan kişi test amaçlı 3 deneme çözdü (30 cevap,
-- %7 doğruluk). Hiçbir tabloda kullanıcı sütunu olmadığı için bu satırlar
-- asıl kullanıcının istatistiklerine karışıyor: ana sayfadaki "genel doğruluk"
-- ve "en zayıf alanların" yanlış çıkıyor. Tek paylaşılan şifre kimliği de
-- ayırmıyordu — JWT'nin sahibi belliydi ama veri sahipsizdi.
--
-- NE PAYLAŞILIR, NE PAYLAŞILMAZ:
--   PAYLAŞILAN (kullanıcı sütunu EKLENMİYOR): hmgs_questions, hmgs_verdicts,
--   hmgs_topics, fts_chunks. Soru bankası, makine denetimi ve konu anlatımları
--   üretmesi para harcayan ortak varlıklar; herkes aynı havuzdan çalışır.
--   Kullanıcıya bölmek aynı soruyu iki kez ürettirir, iki kez denetletir.
--
--   KULLANICIYA AİT: aşağıdaki tablolar. Hepsi "bu kişi ne yaptı" kaydı.
--
-- ARA DURUM: Bu migration'dan sonra hmgs_reports iki dünyaya birden bakıyor —
-- satır kullanıcıya ait (kim bildirdi) ama ETKİSİ paylaşılan havuza. Bir
-- kullanıcının bildirdiği soru herkesin denemesinden ve tekrar kuyruğundan
-- düşer. 007-hmgs-reports.sql'in gerekçesi aynen geçerli: soru gerçekten
-- hatalıysa hatası kime denk geldiğine bağlı değildir.

-- Kullanıcı kayıtları.
--
-- password_hash/password_salt NULL olabilir: varsayılan kullanıcının girişi
-- ADMIN_SECRET üzerinden sürüyor (aşağıya bak). Parola sütunları PBKDF2-SHA256
-- çıktısını hex olarak tutar (bkz. worker/src/lib/password.ts); Workers'ta
-- bcrypt/argon2 yok, WebCrypto'nun verdiği en iyi seçenek bu.
--
-- Parolanın kendisi ASLA bu tabloya yazılmaz; salt satır başına rastgeledir ki
-- iki kullanıcının aynı parolası aynı karmayı üretmesin.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  password_salt TEXT,
  created_at INTEGER NOT NULL     -- unix ms
);

-- Varsayılan kullanıcı: migration öncesi TÜM verinin sahibi.
--
-- Sabit id ('default') seçildi çünkü aşağıdaki UPDATE'ler ve koddaki geriye
-- dönük giriş yolu bu değere isimle bağlanıyor; rastgele UUID olsaydı
-- migration ile kod arasında elle taşınması gereken bir sır doğardı.
--
-- password_hash NULL: bu hesaba parola ATANMIYOR. Girişi eskisi gibi
-- ADMIN_SECRET ile yapılıyor (POST /auth/login gövdesinde username yoksa).
-- Kodun içine parola yazmamak için tek doğru yol bu — migration'a yazılan
-- bir karma, migration dosyasına yazılmış bir parola demektir.
INSERT OR IGNORE INTO users (id, username, password_hash, password_salt, created_at)
VALUES ('default', 'default', NULL, NULL, CAST(strftime('%s', 'now') AS INTEGER) * 1000);

-- ---------------------------------------------------------------------------
-- Kullanıcı verisi tabloları: user_id + sorgu index'leri + mevcut satırların
-- varsayılan kullanıcıya bağlanması.
--
-- Sütun NOT NULL DEĞİL: SQLite'ta dolu bir tabloya NOT NULL sütun eklemek
-- DEFAULT gerektirir, DEFAULT 'default' ise ileride yazılacak her satıra
-- sessizce varsayılan kullanıcıyı yapıştırır — user_id yazmayı unutan bir
-- uç, hatayı veriye gömerdi. NULL bırakıp UPDATE ile doldurmak, unutulan
-- yerin sorguda görünür kalmasını sağlıyor.
-- ---------------------------------------------------------------------------

-- Deneme cevapları — performans panelinin ve planın tek gerçek kaynağı.
ALTER TABLE hmgs_attempts ADD COLUMN user_id TEXT;
UPDATE hmgs_attempts SET user_id = 'default' WHERE user_id IS NULL;
-- Alan doğruluğu ve deneme listesi iki ayrı sorgu; ikisi de user_id ile başlıyor.
CREATE INDEX IF NOT EXISTS idx_hmgs_a_user_subject ON hmgs_attempts(user_id, subject);
CREATE INDEX IF NOT EXISTS idx_hmgs_a_user_exam ON hmgs_attempts(user_id, exam_id);

-- Tekrar kuyruğu — TABLO YENİDEN KURULUYOR, sütun eklemek yetmiyor.
--
-- NEDEN: Eski birincil anahtar question_id idi, yani soru başına TEK satır.
-- İki kullanıcı aynı soruyu yanlış cevapladığında ikincisinin kaydı
-- birincisinin FSRS durumunu (stability, reps, lapses, next_review) EZERDİ.
-- Bu, sütun ekleyerek düzelmeyen bir veri bozulması: aralığı hesaplayan
-- satır tek. Anahtar (question_id, user_id) olmak zorunda.
--
-- SQLite birincil anahtarı ALTER ile değiştiremiyor; tek yol yeni tablo +
-- kopyala + yeniden adlandır. Mevcut satırlar varsayılan kullanıcıya gidiyor.
CREATE TABLE IF NOT EXISTS hmgs_review_new (
  question_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
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
  added_at INTEGER NOT NULL,
  PRIMARY KEY (question_id, user_id)
);

INSERT INTO hmgs_review_new (
  question_id, user_id, subject, next_review, stability, difficulty,
  elapsed_days, scheduled_days, reps, lapses, fsrs_state, last_review, added_at
)
SELECT question_id, 'default', subject, next_review, stability, difficulty,
       elapsed_days, scheduled_days, reps, lapses, fsrs_state, last_review, added_at
  FROM hmgs_review;

DROP TABLE hmgs_review;
ALTER TABLE hmgs_review_new RENAME TO hmgs_review;

-- "Vakti gelmiş sorularım" sorgusu user_id + next_review üzerinden gidiyor.
CREATE INDEX IF NOT EXISTS idx_hmgs_review_user_due ON hmgs_review(user_id, next_review);
CREATE INDEX IF NOT EXISTS idx_hmgs_review_subject ON hmgs_review(subject);

-- Hatalı soru bildirimleri — satır kullanıcıya ait, etkisi paylaşılan havuza.
--
-- question_id UNIQUE kısıtı KORUNUYOR ve bilerek kullanıcıya göre
-- genişletilmiyor. Aynı sorunun iki kullanıcı tarafından bildirilmesi sahibine
-- iki ayrı karar verdirmemeli; soru ya hatalıdır ya değildir. user_id burada
-- "son bildiren kim" bilgisidir, sahiplik değil.
ALTER TABLE hmgs_reports ADD COLUMN user_id TEXT;
UPDATE hmgs_reports SET user_id = 'default' WHERE user_id IS NULL;

-- Çalışma programı.
ALTER TABLE study_plans ADD COLUMN user_id TEXT;
UPDATE study_plans SET user_id = 'default' WHERE user_id IS NULL;
-- "Aktif planım" sorgusu: user_id + is_active + tarihe göre sıralı.
CREATE INDEX IF NOT EXISTS idx_study_plans_user_active
  ON study_plans(user_id, is_active, generated_at DESC);

-- Plandaki görev tikleri.
ALTER TABLE study_task_completions ADD COLUMN user_id TEXT;
UPDATE study_task_completions SET user_id = 'default' WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_study_task_user_plan
  ON study_task_completions(user_id, plan_id);

-- Aşağıdaki dört tabloya sütun ŞİMDİ ekleniyor ama uçları henüz kullanıcıya
-- bağlanmadı (flashcards.ts, quiz.ts, ai.ts bu değişikliğin kapsamı dışında).
-- Sütunu şimdi eklemenin sebebi: veri ayrımı geriye dönük yapılamaz. Bugün
-- yazılan satırın sahibi kaydedilmezse, uçlar bağlandığı gün o satırlar
-- kimsenin olmaz. Sütun boş dursa bile doğru sahibi tutuyor.
--
-- ponytail: flashcard_state'in birincil anahtarı hâlâ card_id, yani kart
-- başına tek satır. O uç kullanıcıya bağlanacaksa hmgs_review ile aynı
-- yeniden kurma gerekir — (card_id, user_id) anahtarı. Bugün tek kullanıcı
-- flashcard çözdüğü için ertelendi.
ALTER TABLE flashcard_state ADD COLUMN user_id TEXT;
UPDATE flashcard_state SET user_id = 'default' WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_flashcard_user_due ON flashcard_state(user_id, next_review);

ALTER TABLE chat_history ADD COLUMN user_id TEXT;
UPDATE chat_history SET user_id = 'default' WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_user_ts ON chat_history(user_id, created_at);

ALTER TABLE quiz_attempts ADD COLUMN user_id TEXT;
UPDATE quiz_attempts SET user_id = 'default' WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_course ON quiz_attempts(user_id, course);

ALTER TABLE practice_responses ADD COLUMN user_id TEXT;
UPDATE practice_responses SET user_id = 'default' WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_practice_user ON practice_responses(user_id, created_at);

ALTER TABLE pomodoro_sessions ADD COLUMN user_id TEXT;
UPDATE pomodoro_sessions SET user_id = 'default' WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_pomodoro_user_started ON pomodoro_sessions(user_id, started_at);
