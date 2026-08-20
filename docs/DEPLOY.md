# Dağıtım

Son güncelleme: 9 Ağustos 2026.

## Canlı durum

| Servis | Adres | Durum |
|---|---|---|
| Frontend | https://hukuk-efe.vercel.app | Canlı (Vercel projesi: `hukuk-efe`) |
| Worker | https://hukuk-worker.efearas06.workers.dev | Canlı |
| D1 | `hukuk-db` (`9c7cb485-…`) | 25 tablo, ~176 MB |
| R2 | `hukuk-pdf` | Kaynak PDF'ler |
| R2 | `hukuk-d1-backups` | Özel D1 yedekleri, 35 gün saklama |
| Vectorize | `hukuk-vectors` | 45.429 parça |

## Her güncellemede

Frontend ve worker **ayrı** dağıtılır. Vercel Git entegrasyonu `main`
push'larını production'a, dal/PR push'larını preview'a otomatik dağıtır.
Worker şimdilik elle dağıtılır; en sık yapılan hata onu unutmaktır.

```bash
# Worker
pnpm --filter ./worker deploy

# Frontend — yalnız otomatik Git akışı kullanılamıyorsa
pnpm deploy:frontend
```

Frontend yeni bir Worker davranışına bağlıysa geriye uyumlu Worker'ı
frontend merge'ünden önce dağıt. Vercel ve Worker arasında dağıtım sırası
garantisi yoktur.

Dağıtım sonrası doğrulama:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://hukuk-efe.vercel.app/api/worker/health
curl -s -o /dev/null -w "%{http_code}\n" https://hukuk-efe.vercel.app/login
```

`/health` 200, `/login` 200 dönmeli.

**Worker'ı neden doğrudan değil, Vercel üzerinden yokluyoruz:** Türk Telekom
Güvenli İnternet `*.workers.dev` adreslerini kesiyor — port 443'e TLS yerine
düz HTTP 307 dönüyor (`Via: 1.0 middlebox`, hedef
`guvenliinternet.turktelekom.com.tr`). Bu yüzden Türkiye'den
`curl https://hukuk-worker.efearas06.workers.dev/health` "SSL wrong version
number" ya da "tlsv1 alert protocol version" verir ve worker ölmüş gibi
görünür. **Uygulama etkilenmez:** tarayıcı workers.dev'e hiç bağlanmıyor,
`/api/worker/*` isteklerini Vercel sunucu tarafında yeniden yazıyor
(`frontend/proxy.ts`). Engellenen tek şey senin doğrudan erişimin. Wrangler de
etkilenmez, o `api.cloudflare.com` kullanıyor. Doğrudan erişim gerekiyorsa
mobil veri ya da VPN yeterli.

 Korumalı bir uç (`/hmgs/reports`) 401
dönmeli — 200 dönüyorsa kimlik doğrulama devre dışı kalmış demektir.

Vercel dağıtımının bittiğini görmek için:

```bash
npx vercel ls
```

En üstteki satır `● Ready` ve `Production` olmalı.

## Sırlar

Adlar ve ne işe yaradıkları `docs/DEVIR.md` §6'da. Değer yazma:

```bash
cd worker
npx wrangler secret put ADMIN_SECRET        # openssl rand -hex 32
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put GEMINI_KEY
npx wrangler secret put TAVILY_API_KEY
npx wrangler secret list                    # neyin tanımlı olduğunu gösterir
```

`ADMIN_SECRET` **hem worker'da hem Vercel'de** aynı olmak zorunda (frontend'in
`proxy.ts`'i JWT'yi onunla doğruluyor). Yalnızca birini değiştirirsen herkes
giriş yapar ama her istek 401 döner. Değiştirirsen dağıtılmış tüm oturumlar
da düşer.

Frontend değişkenleri: Vercel → `hukuk-efe` → Settings → Environment Variables.

## Veritabanı

Şema değişikliği `worker/db/migrations/NNN-ad.sql` olarak dosyaya yazılır,
sonra uygulanır:

```bash
cd worker
npx wrangler d1 execute hukuk-db --remote --file=db/migrations/013-yeni.sql
```

`.github/workflows/d1-backup.yml` her gün 01:17 UTC'de D1'i runner'ın geçici
dizinine aktarır, özel `hukuk-d1-backups` R2 bucket'ına `.tar.gz` olarak yükler
ve geri indirip bit düzeyinde doğrular. D1 tam export'u FTS5 sanal tablolarını
desteklemediği için arşiv iki dosyadan oluşur: normal tablolarla FTS ham
içeriğini aynı snapshot'ta taşıyan `database.sql` ve aranabilir indeksi yeniden
kuran `fts-restore.sql`. R2 yaşam döngüsü yedekleri 35 gün saklar; ham SQL
GitHub artifact'ına veya cache'e girmez.

Elle yedek için GitHub Actions'ta **Günlük D1 yedeği → Run workflow**
kullan. Workflow'un repository secret'ları `CLOUDFLARE_API_TOKEN` ve
`CLOUDFLARE_ACCOUNT_ID` olmalıdır. Her dışa aktarım sürerken D1 sorguları
engellenir; bu nedenle elle koşuyu düşük kullanım saatinde başlat.

Geri yükleme ayrıca ve elle, boş bir hedefte sırasıyla `database.sql` ve
`fts-restore.sql` uygulanarak yapılır. Canlı D1'in üzerine doğrudan uygulanmaz;
önce geçici SQLite/D1 üzerinde satır sayıları, FTS araması ve
`PRAGMA quick_check` doğrulanır.

Silme/güncelleme çalıştırmadan önce aynı `WHERE` ile `SELECT COUNT(*)` çek.

## İlk kurulum (yapıldı, referans)

1. Cloudflare hesabı, R2 bucket `hukuk-pdf`
2. `cd worker && npx wrangler login`
3. `npx wrangler d1 create hukuk-db` → `database_id`'yi `wrangler.toml`'a yaz
4. `npx wrangler d1 execute hukuk-db --remote --file=db/schema.sql`,
   sonra `db/migrations/` içindekiler sırayla
5. `npx wrangler vectorize create hukuk-vectors --dimensions=1024 --metric=cosine`
6. R2 API token (Object Read & Write, `hukuk-pdf` kapsamı) → `scripts/.env`
7. `cd scripts && pnpm upload-pdfs`, sonra `pnpm embed-pdfs`
8. `cd worker && pnpm deploy`
9. Depo kökünden `npx vercel` (proje adı `hukuk-efe`), Root Directory `frontend`
   seçilir. **Dikkat:** Root Directory `frontend` olduğu için dağıtım komutu
   DEPO KÖKÜNDEN çalıştırılır; `frontend/` içinden çalıştırılırsa Vercel
   `frontend/frontend` arar ve "Root Directory does not exist" ile patlar.

## Maliyet

Hepsi ücretsiz kademede: Worker istekleri <100K/gün, R2 ~587 MB / 10 GB,
D1 ~176 MB / 5 GB. Ücretli olan tek şey LLM çağrıları (DeepSeek). Soru üretimi
durduğu için asıl gider kalemi de kapandı; geriye asistan ve konu anlatımı
kaldı — ikisi de hız sınırlı (`docs/DEVIR.md` §5).

Takip: Cloudflare → Workers & Pages → Analytics.
