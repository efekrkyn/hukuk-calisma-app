# AI Çalışma Programı Üreticisi — Design Spec

| | |
|---|---|
| **Tarih** | 2026-05-25 |
| **Durum** | ✅ Canlı (Sprint 3 tamamlandı, deploy: 2026-05-30) |
| **Sahip** | Efe Karakoyun |
| **Hedef milestone** | Sprint 3 (Finallere ~5 hafta) |
| **Tahmini effort** | 3-4 gün |
| **Bağımlılıklar** | Mevcut: D1, DeepSeek V4 provider, practice_responses tablosu |

---

## 1. Amaç (Purpose)

AI'a tek seferde kullanıcı durumunu (kalan zaman, saat bütçesi, zayıf dersler) tanıt → AI sınav dönemine kadar **saat-saat çalışma takvimi** üretsin → kullanıcı bunu görüntüleyip dış dünyada (kitap + defter) çalışsın.

**Kullanım modeli**: Uygulama bir disiplin aracı **değil**. Pomodoro, streak, zorunlu tikleme **yok**. Tikleme **opsiyonel**, ilerleme göstergesi olarak işler ve bir sonraki "yenile"de AI'a geri besleme verir.

## 2. Anti-amaç (Out of scope)

- ❌ Pomodoro timer, çalışma süresi takibi
- ❌ Streak / motivasyon bildirimleri
- ❌ Gün içi otomatik plan rebalance (sadece manuel "yenile")
- ❌ Çoklu kullanıcı, paylaşım, sosyal özellikler
- ❌ Takvim export (.ics) — ileriye atıldı
- ❌ Plan history view (sadece DB'de tutulur, UI yok)

## 3. Karar Verilenler (Decided)

| Karar | Sebep |
|---|---|
| AI-first program üretimi | Kullanıcı manuel görev girişi istemiyor |
| Saat-saat granülarite | Net takvim, "bugün ne yapacağım" tek bakışta |
| Kısa form (6 soru) ile setup | AI sohbet gereksiz, form hızlı |
| Plan immutable + yenileme = yeni satır | History korunur, race condition yok |
| Tikleme opsiyonel | Kullanıcı disipline edilmek istemiyor; ama "yenile"de AI'a geri besleme değerli |
| Practice skorları otomatik beslenir | Zayıf alan AI tarafından dinamik tespit edilir |
| DeepSeek V4 ile structured JSON | Maliyet düşük, kalite yüksek, cömert prompt yapılabilir |
| Aktif plan tek (is_active=1) | Çoklu plan karışıklığı önlenir |

---

## 4. Mimari

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (Next.js 16, Vercel)                               │
│                                                             │
│   /                  → Ana sayfa: bugün için kart + 4 buton │
│   /plan/setup        → 6 soruluk form                       │
│   /plan              → Tam takvim (haftalık ızgara + günlük)│
│                                                             │
└──────────┬──────────────────────────────────┬───────────────┘
           │ POST /ai/plan-generate           │ POST /plan/task-toggle
           │ { form, regenerate_from? }       │ { task_uuid, completed }
           │                                  │
           │                              GET /plan/active
           ▼                                  ▼
┌─────────────────────────────────────────────────────────────┐
│ WORKER (Hono, Cloudflare)                                   │
│                                                             │
│  /ai/plan-generate:                                         │
│    1. Validate form (zod)                                   │
│    2. SELECT FROM practice_responses → practice_stats       │
│    3. regenerate_from varsa → SELECT old plan + tickleri    │
│    4. PROMPT build (system + input + output_schema)         │
│    5. DeepSeekProvider.generateJSON(prompt)                 │
│    6. Validate AI output (zod), retry 1x JSON bozuksa       │
│    7. INSERT study_plans (is_active=1)                      │
│       UPDATE study_plans SET is_active=0 WHERE id != new    │
│    8. Return { plan_id, ai_output, summary }                │
│                                                             │
│  /plan/task-toggle:                                         │
│    INSERT OR DELETE study_task_completions                  │
│                                                             │
│  /plan/active:                                              │
│    SELECT active plan + JOIN completions → JSON             │
│                                                             │
└─────────────────┬───────────────────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ D1 (Cloudflare)                                             │
│                                                             │
│   study_plans (YENİ)                                        │
│   study_task_completions (YENİ)                             │
│   practice_responses (mevcut, okuma için kullanılır)        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 5. D1 Schema

Mevcut 7 tabloya **iki yeni tablo** eklenir. Mevcut hiçbir tablo değiştirilmez.

```sql
-- worker/db/schema.sql sonuna ekle

CREATE TABLE study_plans (
  id TEXT PRIMARY KEY,                   -- UUID v4
  form_input TEXT NOT NULL,              -- JSON: setup form'unun tam kaydı
  ai_output TEXT NOT NULL,               -- JSON: { summary, weeks: [...] }
  ai_model TEXT NOT NULL,                -- "deepseek-v4" gibi (gelecekte değişikse iz)
  generated_at INTEGER NOT NULL,         -- ms epoch
  is_active INTEGER NOT NULL DEFAULT 1   -- 1 aktif, 0 arşiv
);

CREATE INDEX idx_study_plans_active
  ON study_plans(is_active, generated_at DESC);

CREATE TABLE study_task_completions (
  task_uuid TEXT PRIMARY KEY,            -- ai_output içindeki task.uuid
  plan_id TEXT NOT NULL,                 -- study_plans.id'ye FK
  completed_at INTEGER NOT NULL          -- ms epoch
);

CREATE INDEX idx_study_task_plan
  ON study_task_completions(plan_id);
```

**Migration**: `worker/db/migrations/002-study-plans.sql` olarak da ayrı tutulabilir. Wrangler ile remote'a apply edilir:
```
npx wrangler d1 execute hukuk-db --remote --file=db/migrations/002-study-plans.sql
```

### Form input JSON şeması
```typescript
type FormInput = {
  target_exam: "final" | "hmgs" | "both";
  exam_date: string;                  // "2026-06-30"
  weeks_remaining: number;            // frontend hesaplar (today, exam_date) — backend yine validate eder
  weekly_hours_weekday: number;       // 0-12
  weekly_hours_weekend: number;       // 0-12
  study_window_start: string;         // "09:00"
  study_window_end: string;           // "18:00"
  weak_courses: string[];             // courses.ts ID'leri
  notes: string;                      // serbest metin, AI'a iletilir
};
```

### AI output JSON şeması
```typescript
type AiOutput = {
  summary: string;                    // 1-2 cümle özet
  weeks: Array<{
    week_index: number;
    start_date: string;
    end_date: string;
    days: Array<{
      date: string;                   // "2026-05-26"
      weekday: string;                // "Pazartesi"
      tasks: Array<{
        uuid: string;                 // server-side regenerate edilebilir
        time_start: string;           // "09:00"
        time_end: string;             // "10:30"
        course: string;               // courses.ts ID veya "kanunlar"
        topic: string;                // örn. "TBK m.49 — haksız fiil unsurları"
        task_type: "read" | "practice" | "review";
        target_ref?: string;          // "kanunlar/tbk", "practice/borc_004", "reader/<course>/<file>.pdf"
        tip?: string;                 // 1 cümle ipucu
      }>;
    }>;
  }>;
};
```

## 6. AI Prompt

### System prompt
```
Sen Türk hukuku öğrencisi Efe Karakoyun için kişiselleştirilmiş çalışma
programı üreten bir AI asistanısın. Efe AÜHF 4. sınıf öğrencisi, sınav
hazırlığında. Sen sadece program üretirsin — Pomodoro, motivasyon değil,
SAAT-SAAT NET ÇALIŞMA TAKVİMİ.

KURALLAR:
1. Çıktı SADECE JSON, başka metin yok. Markdown code fence YOK.
2. Şema: { summary: string, weeks: [...] }
3. Her hafta 7 gün, her gün 0-N task. Tasksız gün olabilir (haftalık tatil).
4. Saat blokları kullanıcının study_window_start–study_window_end arasında.
5. Bloklar 30/60/90 dakika; tek bir ders + konuya odaklı.
6. task_type üç değerden biri:
   - "read":     PDF okuma (ders kitabı veya kanun maddesi)
   - "practice": pratik case çözme
   - "review":   önceki haftanın özet/tekrarı
7. target_ref opsiyonel ama VARSA tıklanır link olacak:
   - "reader/<course>/<file>.pdf"  (ders kitabı)
   - "kanunlar/<slug>"              (kanun: anayasa, tbk, tmk, tck, cmk, hmk, ttk, ik, iik, iyuk, mohuk, vuk, avukatlik, fsek, sendika, tkhk)
   - "practice/<case_id>"           (pratik: borc_001 vb.)
8. tip opsiyonel: 1 cümle ipucu/odak (ör. "TBK m.49: kusurun 3 unsurunu listele").
9. Zayıf dersleri (weak_courses + düşük practice_stats) %30 daha fazla saat al.
10. Her hafta sonunda (genelde Cumartesi) 1 "review" task ekle.
11. Sınav tarihinden 1 hafta önce yoğunluk %50 artsın.
12. Saatler birbirine bitişik olmasın — minimum 15 dakika mola.
13. Her task'a benzersiz UUID üret (v4 format).
14. notes alanını dikkate al; "Salı 17 sonrası iş var" gibi kısıtları uygula.
15. tick_history varsa, kullanıcının hangi türde görevleri ardarda tikleme
    eğiliminde olduğunu gözet; o ders/konuya yatkınlık varsa hafifçe artır.
```

### Kullanıcı input (her çağrı)
```json
{
  "form": { /* FormInput */ },
  "practice_stats": [
    { "course": "borclar_genel", "avg_score": 52, "case_count": 5 },
    ...
  ],
  "tick_history": [
    { "task_uuid": "...", "course": "borclar_genel", "completed_at": 1234567890 },
    ...
  ]
}
```

### Token tahminleri
- Input: ~3-8K (system + form + stats + tick history)
- Output: ~5-15K (5 hafta × 7 gün × 2-5 task × ~50 token)
- Süre: 15-45 sn DeepSeek V4 ile

### Hata stratejisi
- Output JSON parse hatası → bir kez retry, prompt'a "ÖNCEKİ ÇIKTIN BOZUKTU, SADECE JSON döndür" eklenir.
- İkinci hata → 500 dön, frontend "AI cevabı bozuk, tekrar dene" gösterir.

## 7. UI İskeleti

### (a) Ana sayfa kartı (mevcut sayfaya ekleme)

```
┌─────────────────────────────────────────────┐
│ 📅 Bugün, 26 Mayıs Pazartesi         ⚡ 6/8 │
│                                             │
│ ☐ 09:00–10:30  Borçlar Genel               │
│              TBK m.49 — haksız fiil         │
│              💡 kusurun 3 unsurunu listele  │
│                                             │
│ ☐ 10:45–11:30  Eşya Hukuku                  │
│              MK m.683 — zilyetlik karinesi  │
│                                             │
│ ...                                         │
│ [Programın tamamı →]                        │
└─────────────────────────────────────────────┘
```

Davranış:
- Aktif plan yoksa kart yerine "İlk planını oluştur →" CTA → `/plan/setup`.
- Tik kutusu: tıkla → POST `/plan/task-toggle` → optimistic UI update.
- Görev metni tıklanırsa `target_ref` ile uygulama içi route'a yönlendirir.
- "Programın tamamı" → `/plan`.
- Ana sayfa 4. buton ekleniyor: `[🗓️ Planım]`.

### (b) `/plan/setup` — Form

6 alan, tek sayfa, dikey scroll. Submit'te "AI ~30 sn" loading state. Submit sonrası `/plan` route'una yönlendirme.

### (c) `/plan` — Tam takvim

- Başlık: plan özet bilgisi (tarih aralığı, generated_at, "Yenile" / "Yeni plan" düğmeleri).
- Hafta sekmeleri (5+ hafta için).
- Masaüstü: 7 sütunlu ızgara, hücre = kompakt task kartı.
- Mobil: hafta seç → günler dikey kart yığını.
- Hücre tıklayınca expand: tip + target_ref linki + tik kutusu.
- "Yenile" → mevcut form + tick history + güncel practice_stats ile `/ai/plan-generate` → yeni plan + redirect.
- "Yeni plan" → `/plan/setup` sıfırdan.

### Komponent listesi
- `app/page.tsx` — ana sayfa, `TodayCard` komponenti eklenir.
- `app/plan/setup/page.tsx` — form (client component, server action veya fetch).
- `app/plan/page.tsx` — ana plan görüntü (client, useEffect ile `/plan/active` fetch).
- `components/TodayCard.tsx` — ana sayfa kartı.
- `components/PlanGrid.tsx` — haftalık ızgara.
- `components/TaskCell.tsx` — tek task kartı (tıkla → expand).
- `lib/plan-api.ts` — fetch wrapper'ları.

## 8. Worker Endpoint'leri

### `POST /ai/plan-generate`
- Body: `{ form, regenerate_from? }`
- Akış: validate → fetch practice_stats → fetch old plan tickleri (varsa) → build prompt → AI call → validate output → INSERT plan + UPDATE old `is_active=0` → return.
- Response: `{ plan_id, ai_output, summary }`.
- Auth: şimdilik açık (feature #14 auth ile beraber kapanacak).

### `POST /plan/task-toggle`
- Body: `{ task_uuid, completed }`
- `completed=true` → INSERT (ya da REPLACE), `false` → DELETE.
- Plan_id otomatik tespit (önce active plan'dan task_uuid'i ara).
- Response: `{ ok: true }`.

### `GET /plan/active`
- D1'den is_active=1 plan + tick'leri JOIN.
- Response: `{ plan, completions }`.

### `GET /plan/history` (skip, ileride)

## 9. Migration ve Deployment Sırası

1. D1 schema migration apply (`002-study-plans.sql`).
2. Worker route'ları yaz + deploy.
3. Frontend route'ları yaz + Vercel deploy.
4. Manuel test: setup → generate → tik → yenile.
5. Hata: önceki plan kalıyorsa migration rollback komutu.

## 10. Açık Sorular (Open Questions)

| # | Soru | Default karar |
|---|---|---|
| 1 | Plan AI rebalance gerçekten gün başına 1 mi yoksa sadece manuel "yenile" mi? | Sadece manuel (cost + öngörülebilirlik) |
| 2 | Görev tıklanınca `target_ref` aynı sekmede mi yeni sekmede mi açılsın? | Aynı sekme, "geri" butonu plan'a döndürür |
| 3 | Birden fazla plan eş zamanlı olabilir mi (örn. final + HMGS ayrı)? | Hayır, tek aktif. target_exam="both" tek plan'da çözer |
| 4 | DeepSeek V4 yanıt vermezse fallback model? | Gemini fallback opsiyonel, MVP'de yok |
| 5 | Tick history kaç kayıt geriye AI'a iletilir? | Son 50 tik veya son 30 gün |

## 11. Başarı Kriterleri (Success Criteria)

1. Kullanıcı `/plan/setup` doldurup `/plan`'a 60 sn içinde varır.
2. Üretilen plan AI'ın doğru zaman penceresini, doğru zayıf ders ağırlığını, doğru sınav tarihini yansıtır.
3. Ana sayfa açıldığında bugünün kartı görünür (cache değil, gerçek zamanlı).
4. Tik atma `target_ref` linkini bozmaz, tik durumu page refresh sonrası kalıcı.
5. "Yenile" basıldığında AI önceki tikleri ve son pratik skorlarını gözeterek programı revize eder.

## 12. İlerideki Genişletme Noktaları

- Plan history view (`/plan/history`).
- iCal export (`.ics` link).
- Bildirim sistemi (PWA Push API — sabah 09:00'da "Bugünün ilk görevi: ...").
- Multi-turn AI tutor entegrasyonu (Yaklaşım C, feature grubu).
- Pomodoro entegrasyonu (eğer kullanıcı sonradan isterse — D1'de `pomodoro_sessions` zaten var).
