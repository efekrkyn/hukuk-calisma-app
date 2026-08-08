# D1 Yedeği ve Frontend Git Entegrasyonu Tasarımı

## Amaç

D1'in tek nüsha olma riskini günlük doğrulanmış dışa aktarmayla kapatmak ve
frontend'i mevcut Vercel projesinden `main` dalına koşulsuz otomatik bağlamak.

## Kapsam

Bu değişiklik yalnızca iki işi kapsar:

1. `hukuk-db` için günlük ve elle tetiklenebilir yedek.
2. `hukuk-efe` Vercel projesinin `efekrkyn/hukuk-calisma-app` GitHub deposuna
   bağlanması.

Dal koruması, Worker dağıtım gate'i ve migration uygulama otomasyonu bu
değişikliğin parçası değildir. Worker, kullanıcı "koruma açık" diyene kadar
elle dağıtılmaya devam eder.

## D1 yedek akışı

- GitHub Actions işi her gün 01:17 UTC'de ve elle tetiklendiğinde çalışır.
  Saat başından kaçınılması, GitHub'ın yoğun saatlerde zamanlanmış işleri
  geciktirebilmesi içindir.
- İş, repodaki sabit Wrangler sürümünü kullanarak şu dışa aktarmayı geçici
  runner dizinine yapar:

  ```sh
  npx wrangler d1 export hukuk-db --remote --output=backup-$(date +%Y%m%d).sql
  ```

- Ham SQL hiçbir zaman checkout dizinine, cache'e veya GitHub artifact'ına
  yazılmaz. Public depoda artifact kullanmak veri sızıntısı riski doğurur.
- Export tamamlanınca dosyanın boş olmadığı doğrulanır ve özel
  `hukuk-d1-backups` R2 bucket'ına zaman damgalı bir anahtarla yüklenir.
- Yüklenen nesne yeniden geçici dizine indirilir ve yerel dosyayla `cmp`
  üzerinden bit düzeyinde karşılaştırılır. Export, upload veya doğrulamanın
  herhangi biri başarısızsa iş başarısız sayılır.
- Geçici SQL dosyaları adım sonunda silinir; runner'ın kapanması ikinci
  temizlik katmanıdır.
- Bucket public development URL veya custom domain almaz. 35 günlük lifecycle,
  bugünkü yaklaşık 176 MB D1 boyutunda günlük kopyaları yayımlanan 10 GB-month
  Standard ücretsiz kotasının altında tutmayı hedefler. İlk gerçek SQL boyutu
  ölçülür ve bu varsayım sonuç raporunda açıkça kontrol edilir.
- D1 export sırasında veritabanı sorgu sunamayabilir. İlk koşunun süresi ve
  canlı sağlık etkisi ölçülür; tahmin edilmez.

GitHub sırları yalnız ayarlarda tutulur:

- `CLOUDFLARE_API_TOKEN`: yalnız ilgili hesapta D1 export ve yeni R2 bucket'ına
  nesne yazma/okuma için gereken en dar yetkiler.
- `CLOUDFLARE_ACCOUNT_ID`: hesap kimliği; repo secret olarak tutulur.

İleride Worker gate aynı yedek işini dağıtım ön koşulu olarak çağıracak, fakat
bu tasarım Worker deploy'u veya migration'ı otomatikleştirmez.

## Frontend Git akışı

- Yeni Vercel projesi açılmaz; mevcut `hukuk-efe` kullanılır.
- Git bağlantısından önce Vercel `rootDirectory` değeri `frontend` yapılır.
  Monorepo kökünün yanlışlıkla Next.js projesi sanılmasını bu önler.
- Proje `efekrkyn/hukuk-calisma-app` deposuna bağlanır. `main` push'ları
  production, diğer dal/PR push'ları preview deployment oluşturur.
- `frontend/vercel.json` ve mevcut Vercel environment variable değerleri
  değiştirilmez. Bağlantı işlemi tek başına deployment başlatmaz.
- Bağlantı API'den `link` ve `rootDirectory` alanlarıyla doğrulanır. Frontend
  kaynak değişikliği olmadığı için bu adımda zorunlu production deploy yoktur.

## Hata ve geri alma

- Yedek doğrulanmadan zamanlanmış iş başarılı sayılmaz. R2 nesnesi oluşmuş ama
  doğrulama başarısız olmuşsa nesne kanıt kabul edilmez; sonraki başarılı koşu
  ayrı zaman damgasıyla yeni nesne yazar.
- Vercel bağlantısında yanlış repo veya kök görülürse bağlantı kurulmaz.
  Bağlantı sonrası yanlışlık doğrulanırsa `vercel git disconnect` ile yalnız
  Git entegrasyonu geri alınır; mevcut production deployment etkilenmez.
- D1 üzerinde `DELETE`, `UPDATE`, migration veya restore çalıştırılmaz.

## Doğrulama

- Workflow YAML sözdizimi ve git diff kontrol edilir.
- İlk export'un süresi, SQL boyutu, R2 anahtarı ve bit düzeyi doğrulama sonucu
  kaydedilir; SQL içeriği loglanmaz.
- R2 bucket'ın private olduğu, lifecycle kuralı ve en az bir doğrulanmış nesne
  uzaktan listelenir.
- Vercel API'de `rootDirectory: frontend` ve doğru GitHub `link` görülür.
- Repo testleri ve build değişiklik sonrası bir kez çalıştırılır.

