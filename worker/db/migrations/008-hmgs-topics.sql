-- AI konu anlatımı önbelleği.
--
-- NEDEN ÖNBELLEK: Bir alt konunun anlatımını üretmek RAG çekimi + uzun bir
-- DeepSeek çağrısı demek; para harcıyor ve saniyeler sürüyor. Kanun metni
-- değişmediği sürece aynı alt konunun anlatımı da değişmez — kullanıcı konuya
-- her girdiğinde yeniden üretmek aynı parayı tekrar tekrar ödemek olur.
-- İlk üretimden sonra okuma bedava; yenilemek istendiğinde /hmgs/topic
-- refresh=true ile üzerine yazılır.
--
-- PRIMARY KEY (subject, subtopic): anlatımın kimliği bu ikili. Ayrı bir id
-- sütunu, aynı konu için iki satır oluşmasına kapı bırakırdı; INSERT OR REPLACE
-- ile yenileme de bu bileşik anahtar sayesinde tek satırda kalıyor.
-- Anahtarın kendisi index olduğundan ayrıca index açılmadı.
--
-- sources: anlatımın dayandığı kanun parçaları (JSON [{pdf, page}]). Sorularda
-- olduğu gibi burada da dayanak saklanıyor — anlatımda bir hata görülürse
-- hangi metinden çıktığı geriye dönük denetlenebilsin.

CREATE TABLE IF NOT EXISTS hmgs_topics (
  subject TEXT NOT NULL,          -- HMGS_SUBJECTS içindeki id
  subtopic TEXT NOT NULL,         -- alanın subtopics/doctrineSubtopics dizisindeki ad
  content TEXT NOT NULL,          -- Markdown anlatım
  sources TEXT NOT NULL,          -- JSON [{pdf, page}]
  created_at INTEGER NOT NULL,    -- unix ms — son üretim zamanı
  PRIMARY KEY (subject, subtopic)
);
