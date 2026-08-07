-- Sorunun hangi alt konudan üretildiğini tutar.
--
-- Üretici alt konuyu zaten seçip isteme yazıyordu ama döndürmüyordu, bilgi
-- kayboluyordu. Kaydedilince iki şey açılıyor: konu anlatımından o konunun
-- sorularına geçiş, ve performans panelinde alan-altı zayıflık ("Borçlar'da
-- zayıfsın" yerine "Borçlar'ın zamanaşımı konusunda zayıfsın").
--
-- NULL kalabilir: bu sütundan önce üretilmiş sorular sınıflandırılana kadar
-- boş duracak, sorgular NULL'a dayanıklı yazılmalı.

ALTER TABLE hmgs_questions ADD COLUMN subtopic TEXT;

CREATE INDEX IF NOT EXISTS idx_hmgs_q_subtopic ON hmgs_questions(subject, subtopic);
