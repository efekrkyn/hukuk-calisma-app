# Devir Notu

Son güncelleme: **9 Ağustos 2026**. Bu belge projeyi hiç görmemiş birinin
(insan ya da ajan) devralabilmesi için yazıldı: ne olduğu, nasıl çalıştığı,
hangi kararların neden verildiği ve nelerin eksik kaldığı.

---

## 1. Ne olduğu

İrem'in HMGS'ye (Hukuk Mesleklerine Giriş Sınavı) hazırlanması için yazılmış
bir PWA. Efe Karakoyun yazdı. Ticari ürün değil, satılmıyor, iki kullanıcısı
var.

**Sınav:** 27 Eylül 2026 · 120 soru · 155 dakika · geçme notu 70 · 20 alan.
Bu sabitler `worker/src/lib/hmgs-subjects.ts` içinde
(`HMGS_TOTAL_QUESTIONS`, `HMGS_PASS_SCORE`).

**Canlı adresler**

| Servis | Adres |
|---|---|
| Frontend | https://hukuk-efe.vercel.app |
| Worker | https://hukuk-worker.efearas06.workers.dev |
| Depo | https://github.com/efekrkyn/hukuk-calisma-app |

---

## 2. Mimari

```
Tarayıcı (PWA)
   │
   ├─ Next.js 16 (Vercel) ── proxy.ts ──┐   /api/worker/* → worker'a rewrite
   │    oturum çerezi: hukuk_session     │   Authorization: Bearer <jwt>
   │                                     ▼
   └──────────────────────► Cloudflare Worker (Hono)
                                 ├─ D1        hukuk-db     (durum + sorular)
                                 ├─ Vectorize hukuk-vectors (RAG)
                                 ├─ R2        hukuk-pdf    (kaynak PDF'ler)
                                 ├─ R2        hukuk-d1-backups (D1 yedekleri)
                                 ├─ Workers AI @cf/baai/bge-m3 (gömme)
                                 ├─ DeepSeek  (üretim + denetim)
                                 ├─ Gemini    (çapraz doğrulama)
                                 ├─ Tavily    (web arama)
                                 └─ MCP: mevzuat.surucu.dev, yargimcp.surucu.dev
```

**Kimlik doğrulama.** Tek bir JWT, `ADMIN_SECRET` ile HS256 imzalı. Hem
frontend'in `proxy.ts`'i hem worker aynı sırla doğruluyor — bu yüzden sır iki
tarafta da aynı olmak zorunda. İki giriş yolu var: kullanıcı adı boş
bırakılırsa parola doğrudan `ADMIN_SECRET` ile karşılaştırılıyor (eski yol,
dağıtılmış tokenlar buna bağlı, kaldırılamaz); kullanıcı adı doluysa `users`
tablosundan PBKDF2-SHA256 ile doğrulanıyor.

**RAG.** Kaynak PDF'ler R2'de; metin parçaları hem Vectorize'da (anlamsal) hem
D1 FTS5 `fts_chunks` tablosunda (kelime) duruyor — 45.429 parça. Arama ikisini
birleştiriyor, sonra `@cf/baai/bge-reranker-base` yeniden sıralıyor.

**Aralıklı tekrar.** `ts-fsrs`. Yanlış cevaplanan soru `hmgs_review` kuyruğuna
düşüyor, `/tekrar` sayfası onu çıkarıyor.

---

## 3. Verinin bugünkü hâli

| Ne | Sayı |
|---|---|
| Soru | 3.466 |
| Makine denetiminden `correct` alan | 2.970 |
| Denetlenmemiş | **0** |
| İkinci modelle çapraz doğrulanan | 203 (%95 mutabakat) |
| Konu anlatımı (önceden üretilmiş) | 160 |
| RAG metin parçası | 45.429 |
| Kullanıcı | 2 (`default` = Efe, `irem`) |
| Kayıtlı cevap | 270 |

**D1 yedekleri.** `.github/workflows/d1-backup.yml` her gün 01:17 UTC'de
`hukuk-db` veritabanını özel `hukuk-d1-backups` R2 bucket'ına aktarır,
geri indirip bit düzeyinde doğrular. Cloudflare tam export'u FTS5 sanal
tablolarını desteklemediği için hedefli export normal tabloları ve
`fts_chunks_content` gölge içeriğini tek snapshot'ta alır; arşivdeki
`fts-restore.sql` aranabilir indeksi yeniden kurar.
Bucket yaşam döngüsü kopyaları 35 gün saklar. Her dışa aktarım sürerken diğer
D1 istekleri engellenir; workflow bu nedenle düşük kullanımlı bir saatte
çalışır.

**Soru bankası kapandı.** 8 Ağustos 2026'da yeni soru üretmeme kararı verildi.
`/hmgs/generate` uç noktası duruyor ama kullanılmayacak. Denetim (`/verify`),
çapraz doğrulama (`/cross-check`) ve bildirim akışı açık kalmalı — bunlar
mevcut soruların kalitesini yükseltiyor, sayısını değil.

---

## 4. Kalite denetimi — nasıl çalıştığı ve nereye kadar güvenilir

Sorular kanun metninden LLM ile üretiliyor. Üç katmanlı denetim var:

1. **Makine denetimi** (`hmgs-verify.ts`, DeepSeek `deepseek-reasoner`). Soruyu
   kaynak metne karşı okuyup `correct` / `incorrect` / `ambiguous` diyor.
   Verdiği hüküm `hmgs_verdicts` tablosunda.
2. **Çapraz doğrulama** (Gemini 2.5 Flash). Bağımsız ikinci görüş. 203 soruda
   koşturuldu, iki hakem %95 mutabık. Devamı Gemini ücretsiz kotasına takılı
   (~50 soru/tur).
3. **Kullanıcı bildirimi** (`/bildirimler`). En değerlisi bu: sınava hazırlanan
   kişi hatalı soruyu bildiriyor, karar veren sahibi. Kanal işliyor: ilk
   bildirim (İdare Hukuku, İYUK m.34/2 — "bulunduğu YAHUT yeni bağlandığı
   yer" iki şıkkı da geçerli kılıyordu) 20.08.2026'da doğrulanıp silindi.
   Bildiren kişi, makine hakemi ve kanun metni aynı sonuca varmıştı.

**Dürüst olmak gerekirse:** rozet insan onayı değil, ikinci bir modelin
görüşü. Elle yapılan 50 soruluk örneklem denetiminde kusur oranı ~%20–25
çıktı. Uygulamayı yazan kişinin hukuk bilgisi soruları teyide yetmiyor;
gerçek denetim kanalı 3. maddedir. Devralan kişi bankanın hatasız olduğunu
varsaymamalı.

**Ölçülen, tahmin edilmeyen eşikler** (değiştirmeden önce yeniden ölç):
tekrar eleme benzerliği 0,5 · uzunluk kapısı 1,4 · senaryo oranı %79 ·
yeniden denetimde başarısızlık %7.

---

## 5. Verilmiş kararlar ve gerekçeleri

Bunlar kodda "neden" yorumu olarak da duruyor; en kritik olanlar:

- **Denetlenmiş sorular varsayılan.** `/hmgs/exam` yalnızca denetimden geçmiş
  soruları veriyor (`verified=0` ile kapatılabiliyor). Sebep: kullanıcı
  denetlenmemiş soruyla çalışmak istemedi.
- **`ambiguous` hükmü var.** Hakem başta yalnızca doğru/yanlış diyebiliyordu;
  "iki şık da savunulabilir" durumunu göremiyordu ve bu, bulunan kusurların
  en yaygın biçimiydi.
- **Denetim madde düzeyinde.** Kanun düzeyinde eşleştirme, soruyu yanlış
  maddeye karşı doğrulatıyordu (`hasArticle()`).
- **Terk edilmiş deneme sayılmıyor.** Başlanıp bırakılan denemenin boş
  soruları hem tekrar kuyruğunu dolduruyor hem başarı oranını çökertiyordu.
  Kural: cevaplanma oranı %50'nin altındaysa boşlar yanlış sayılmaz.
  (Tek düzeltmede tekrar kuyruğu 256 → 4, doğruluk %1 → %7.)
- **Hız sınırı** (`rate-limit.ts`, D1 sabit pencere): `uretim` 60/saat,
  `denetim` 400/saat, `anlatim` 60/saat, `asistan` 120/saat. Sebep: workers.dev
  adresleri taranıyor ve arkada para harcayan uçlar var. Veritabanı hata
  verirse sınır **açık kalıyor** (fail-open) — sınır, uygulamayı kilitlemekten
  daha az önemli.
- **Konu anlatımları önceden üretildi** (160 adet) ve tarayıcıda
  `localStorage`'da önbelleklendi (3 MB, LRU). Sebep: Workbox POST isteğini
  önbellekleyemiyor.

---

## 6. Ortam değişkenleri

Değerler bu depoda **yok**. Adlar ve nereden geldikleri:

**Worker** (`wrangler secret put <AD>` ile yazılır, `npx wrangler secret list`
ile listelenir):

| Ad | Ne için |
|---|---|
| `ADMIN_SECRET` | JWT imzası + kullanıcı adsız giriş parolası |
| `DEEPSEEK_API_KEY` | Soru üretimi ve denetim |
| `GEMINI_KEY` | Çapraz doğrulama |
| `TAVILY_API_KEY` | Asistanın web araması |

Yerel geliştirmede aynı adlar `worker/.dev.vars` dosyasına yazılır.

**Frontend** (Vercel proje ayarları ve yerelde `frontend/.env.local`):

| Ad | Ne için |
|---|---|
| `ADMIN_SECRET` | `proxy.ts`'in JWT doğrulaması — worker'daki ile **aynı** olmalı |
| `NEXT_PUBLIC_WORKER_URL` | Worker adresi (varsayılan koda gömülü) |

**GitHub Actions** (repository secrets): `CLOUDFLARE_API_TOKEN` D1 dışa
aktarma ile yedek bucket'ında nesne okuma/yazma yetkisi; `CLOUDFLARE_ACCOUNT_ID`
hesap kimliği için kullanılır. Değerleri workflow veya loglarda yer almaz.

**Scripts** (`scripts/.env`, yalnızca tek seferlik PDF/gömme işleri için):
`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
`SOURCE_DIR`.

Her dizinde `.env.example` var; kopyalayıp değerleri Efe'den al.

---

## 7. Bilinen eksikler

Öncelik sırasıyla:

1. **Çapraz doğrulama 203 soruda kaldı** (bankanın %6'sı). Gemini ücretsiz
   kotası engel. Ücretli anahtar ya da uzun süreye yayılmış toplu iş gerekir.
2. **Tarayıcıda çalışma-anı kontrolü yapılmadı.** Konsol hataları, hidrasyon
   uyarıları ve gerçek ekranda tema kontrolü hiç bakılmadı. Statik tarama
   yapıldı (4 kontrast hatası bulunup düzeltildi) ama bu tarayıcı testinin
   yerini tutmaz.
3. **Worker dağıtımı hâlâ elle.** Frontend `main` push'larında Vercel'e otomatik
   gider; Worker için test + yedek ön koşullu gate, dal koruması açıldıktan
   sonra kurulacak.
4. **Otomatik test yalnızca worker'da.** Frontend'de hiç test yok; React test
   altyapısı da kurulu değil.
5. **`data/` dizini 59 MB** ve kısmen depoda. Büyük üretilmiş dosyalar
   yeniden üretilebilir; istenirse temizlenebilir.

---

## 8. İlk gün: devralanın yapacakları

```bash
git clone https://github.com/efekrkyn/hukuk-calisma-app.git
cd hukuk-calisma-app/uygulama
pnpm install
cp frontend/.env.example frontend/.env.local     # değerleri Efe'den al
cp worker/.dev.vars.example worker/.dev.vars
pnpm test                                        # 16/16 geçmeli
pnpm dev                                         # :3000 ve :8787
```

Sonra sırasıyla: `AGENTS.md`'yi oku (sınırlar orada), `worker/src/routes/hmgs.ts`
dosyasının başındaki yorumu oku (soru akışının tamamı orada anlatılıyor),
`/bildirimler` sayfasına bak (bekleyen kullanıcı bildirimi olabilir).

**Cloudflare ve Vercel hesapları Efe'ye ait.** Devralan kişi kendi erişimini
alana kadar dağıtım yapamaz; `npx wrangler login` ve `npx vercel login`
gerekir.
