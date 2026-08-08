# D1 Yedeği ve Frontend Git Entegrasyonu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** D1'i günlük özel R2 yedeğiyle korumak ve mevcut frontend projesini GitHub push'larına bağlamak.

**Architecture:** Tek bir yeniden kullanılabilir GitHub Actions workflow'u normal D1 tablolarını ve FTS5 gölge içeriğini geçici dizinde üretir, test edilen geri kurma SQL'iyle arşivler, özel R2'ye yükler ve geri indirerek doğrular. Vercel tarafında mevcut projenin kökü `frontend` yapılır ve aynı GitHub reposuna bağlanır; Worker otomasyonu bu planın dışında kalır.

**Tech Stack:** GitHub Actions, pnpm 10.10.0, Wrangler 4.94.x, Cloudflare D1/R2, Vercel CLI 58.9.0.

---

### Task 1: Yedek workflow'u ve güvenli dosya sınırları

**Files:**
- Create: `.github/workflows/d1-backup.yml`
- Create: `worker/db/fts-restore.sql`
- Modify: `.gitignore`
- Modify: `worker/src/lib/rag.test.ts`
- Modify: `docs/DEPLOY.md`
- Modify: `docs/DEVIR.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: FTS geri kurma SQL'ini çalıştırılabilir kontrolle ekle**

  D1 tam export'u FTS5'i desteklemediği için `fts_chunks_content` verisini gerçek
  FTS5 indeksine dönüştür. Mevcut `rag.test.ts` içinde geçici SQLite ile satır
  ve `MATCH` sorgusunu doğrula; yeni test framework'ü ekleme.

- [ ] **Step 2: Workflow'u geçici dizin, private R2 ve remote `cmp` doğrulamasıyla ekle**

  Workflow yalnız `schedule`, `workflow_dispatch` ve ileride gate için
  `workflow_call` tetikleyicilerini taşır. `permissions: contents: read`, sabit
  pnpm sürümü, pinned action SHA'ları, `cancel-in-progress: false` ve 45 dakikalık
  timeout kullanır. Normal tablolar ile FTS gölge içeriği tek hedefli export'ta
  alınır, geri kurma SQL'iyle `.tar.gz` yapılır. Ham SQL artifact/cache yapılmaz.

- [ ] **Step 3: Yerel dump desenini ignore et ve operasyon belgelerini güncelle**

  `.gitignore` içine `backup-*.sql` ekle. `docs/DEPLOY.md`, `docs/DEVIR.md` ve
  `AGENTS.md` içinde "yedek yok" ile "git push frontend'i tetiklemez"
  ifadelerini yeni gerçekliğe göre düzelt; Worker'ın hâlâ manuel olduğunu açıkça
  koru.

- [ ] **Step 4: Yapılandırmayı statik doğrula**

  Run: `git diff --check`

  Expected: çıkış kodu `0`, çıktı yok.

  Run: `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/d1-backup.yml"); puts "ok"'`

  Expected: `ok`.

- [ ] **Step 5: Tasarım ve workflow değişikliklerini commit et**

  ```sh
  git add docs/superpowers/specs/2026-08-08-d1-yedegi-ve-frontend-git-design.md \
    docs/superpowers/plans/2026-08-08-d1-yedegi-ve-frontend-git.md \
    .github/workflows/d1-backup.yml worker/db/fts-restore.sql worker/src/lib/rag.test.ts \
    .gitignore AGENTS.md docs/DEPLOY.md docs/DEVIR.md
  git commit -m "ops: günlük D1 yedeğini hazırla"
  ```

### Task 2: Cloudflare yedek kaynağı ve ilk doğrulanmış export

**Files:** None.

- [ ] **Step 1: Private bucket'ı oluştur ve public erişimin kapalı olduğunu doğrula**

  Run: `pnpm --filter ./worker exec wrangler r2 bucket create hukuk-d1-backups`

  Expected: bucket oluşturma başarısı.

- [ ] **Step 2: 35 günlük lifecycle ekle**

  Run: `pnpm --filter ./worker exec wrangler r2 bucket lifecycle add hukuk-d1-backups gunluk-yedekler backups --expire-days 35 --force`

  Expected: lifecycle kuralı oluşturma başarısı.

- [ ] **Step 3: İlk arşivi geçici dizinde üret, R2'ye yükle ve geri indirerek karşılaştır**

  Workflow'daki aynı komutlar yerel Wrangler OAuth oturumuyla çalıştırılır.
  Arşiv ayrıca geçici SQLite'a geri yüklenir. Süre ve dosya boyutu gösterilir;
  SQL içeriği gösterilmez. Başarılı `cmp` ve `PRAGMA integrity_check` çıkışları
  doğrulanmalıdır.

- [ ] **Step 4: GitHub Actions sırlarını ayarlayıp workflow'u `main`e gönder**

  `CLOUDFLARE_API_TOKEN` ile `CLOUDFLARE_ACCOUNT_ID` yalnız GitHub repository
  secrets içinde oluşturulur. Token değeri dosya, terminal çıktısı veya komut
  satırına yazılmaz. Commit `main`e gönderilir ve `workflow_dispatch` koşusu
  başarılı olana kadar günlük otomasyon tamamlanmış sayılmaz.

### Task 3: Vercel GitHub entegrasyonu

**Files:** None.

- [ ] **Step 1: Mevcut projede monorepo kökünü ayarla**

  Vercel `hukuk-efe` projesinde API ile `rootDirectory` değeri `frontend`
  yapılır ve GET yanıtıyla doğrulanır.

- [ ] **Step 2: Doğru GitHub reposunu bağla**

  Run: `npx --yes vercel@58.9.0 --cwd frontend git connect https://github.com/efekrkyn/hukuk-calisma-app.git`

  Expected: mevcut `hukuk-efe` projesi ve doğru repo adı görülerek bağlantı
  başarısı. `--yes` kullanılmaz.

- [ ] **Step 3: Uzak ayarı doğrula**

  Vercel GET `/v9/projects/prj_JJo184tO4XLgzSlXSq3xTkErd6wr` yanıtında `rootDirectory` değeri
  `frontend`; `link.repo` değeri `hukuk-calisma-app`; production branch değeri
  `main` olmalıdır.

### Task 4: Son doğrulama ve durma noktası

**Files:** None.

- [ ] **Step 1: Repo kalite kapılarını çalıştır**

  Run: `pnpm test`

  Expected: 16 test dosyasının tamamı geçer.

  Run: `pnpm build`

  Expected: frontend build ve Worker typecheck geçer.

- [ ] **Step 2: Canlı salt-okunur smoke kontrollerini çalıştır**

  Worker `/health` ve frontend `/login` `200`; korumalı Worker uç noktası `401`
  dönmelidir.

- [ ] **Step 3: Sonuçları göster ve dur**

  Yedek nesnesi, boyut, süre, schedule koşusu ve Vercel link durumu raporlanır.
  Dal korumasına veya Worker otomasyonuna dokunulmaz; kullanıcı onayı beklenir.
