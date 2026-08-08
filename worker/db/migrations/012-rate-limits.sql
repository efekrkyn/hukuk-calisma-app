-- Pahalı uçlar için kullanıcı başına hız sınırı.
--
-- NEDEN: /hmgs/generate, /hmgs/verify, /hmgs/cross-check, /hmgs/topic ve
-- /ai/* her çağrıda DeepSeek veya Gemini parası harcıyor. Giriş yapmış
-- herhangi biri (ya da hatalı bir betik) bunları sınırsız çağırabiliyordu.
--
-- Soyut bir risk değil, YAŞANDI: 2026-08-07 gecesi yeniden denetim turunda
-- zaman koruması eksikti; kaynaksız kalan soru her turda yeniden seçilip
-- yeniden denetlendi. Döngü kendini bitiremedi ve yaklaşık 40 dakika boyunca
-- aynı sorulara para harcandı. Sınır olsaydı kendiliğinden dururdu.
--
-- SABİT PENCERE seçildi (kayan pencere değil): pencere sınırında iki katına
-- kadar patlama olabilir ama tek satır okuma/yazma ile çalışıyor. Amaç adil
-- paylaşım değil, kaçak tüketimi durdurmak; kaba olması yeterli.

CREATE TABLE IF NOT EXISTS rate_limits (
  -- user_id + kova adı. Kova uç grubu: her uç ayrı sayılmıyor, aynı maliyet
  -- sınıfındakiler tek bütçeyi paylaşıyor.
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,   -- unix ms
  count INTEGER NOT NULL DEFAULT 0
);

-- Eski pencereleri toplu silmek için.
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
