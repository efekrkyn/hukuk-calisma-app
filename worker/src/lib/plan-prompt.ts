import { HMGS_SUBJECTS, HMGS_PASS_SCORE, HMGS_TOTAL_QUESTIONS } from "./hmgs-subjects";
import { allSubtopics } from "./hmgs-classify";
import { apportion } from "./apportion";
import { WEEKDAYS, type FormInput } from "./plan-schemas";
import type { StudyStats } from "./plan-store";

/**
 * HMGS çalışma planı istemi.
 *
 * Model tarih aritmetiği ve pay hesabı YAPMAZ: günler, kalan gün sayısı ve
 * alan başına hedef yüzde burada hesaplanıp hazır veriliyor. Eski istem
 * bunları modele bırakıyordu ve plan uydurma tarihlerle dönüyordu.
 */

/**
 * Plan kaç hafta ileriyi kapsar.
 *
 * ponytail: 2 hafta sabit — deepseek-chat varsayılan çıktı sınırı 4096 token
 * ve 14 günlük takvim (~40 görev) zaten ~2000 token. 4 haftaya çıkmak JSON'u
 * yarıda kestiriyor. Sınava 3 ay varsa kullanıcı planı yeniden üretir.
 * Daha uzun plan gerekirse önce ai-provider'da max_tokens açılmalı.
 */
export const PLAN_WEEKS = 2;

export type PlanDay = { date: string; weekday: string; off: boolean };

/** Türkçe gün adları, JS getUTCDay() sırasıyla (0 = Pazar). */
const TR_WEEKDAY = ["Pazar", ...WEEKDAYS.slice(0, 6)] as const;

function toUtcMs(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Türkiye'deki bugün.
 *
 * Worker UTC'de koşuyor; UTC gece yarısı ile Türkiye saati arasında 3 saat
 * var, o aralıkta plan bir gün geriden başlıyordu. Tarayıcıdaki TodayCard
 * yerel günü kullandığı için iki taraf aynı günü göstermeli.
 */
export function istanbulToday(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
}

export function daysBetween(fromIso: string, toIso_: string): number {
  return Math.round((toUtcMs(toIso_) - toUtcMs(fromIso)) / 86_400_000);
}

/** "2026-08-07" → "Cuma". Plan ızgarası günleri gün adına göre sütunluyor. */
export function weekdayOf(iso: string): string {
  return TR_WEEKDAY[new Date(toUtcMs(iso)).getUTCDay()];
}

/** Plan penceresindeki günler; tatil günleri işaretli. */
export function buildDays(
  startIso: string,
  weeks: number,
  daysOff: readonly string[]
): PlanDay[] {
  const off = new Set(daysOff);
  const start = toUtcMs(startIso);
  const out: PlanDay[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const ms = start + i * 86_400_000;
    const date = toIso(ms);
    const weekday = weekdayOf(date);
    out.push({ date, weekday, off: off.has(weekday) });
  }
  return out;
}

export type SubjectShare = {
  id: string;
  name: string;
  /** Sınavdaki soru sayısı = alan ağırlığı. */
  count: number;
  accuracy: number | null;
  answered: number;
  /** Toplamı 100 olan hedef zaman payı. */
  share: number;
  subtopics: string[];
  weak_subtopics: Array<{ name: string; accuracy: number }>;
};

/**
 * Alan başına hedef zaman payı.
 *
 * Sadece sınav ağırlığına bakmak, kullanıcının zaten %90 yaptığı Medeni'ye
 * en çok saati vermek demek. Ağırlık zayıflıkla çarpılıyor: doğruluk düştükçe
 * çarpan 1 → 2 arasında büyüyor. Ölçülmemiş alan 1.5 alıyor — "iyi" varsaymak
 * onu hiç çalıştırmaz, "kötü" varsaymak ölçülmüş zayıf alanın önüne geçirir.
 */
export function subjectShares(stats: StudyStats): SubjectShare[] {
  const byId = new Map(stats.subjects.map((s) => [s.id, s]));
  const rows = HMGS_SUBJECTS.map((s) => {
    const st = byId.get(s.id);
    const acc = st?.accuracy ?? null;
    const factor = acc === null ? 1.5 : 1 + (100 - acc) / 100;
    return {
      id: s.id,
      name: s.name,
      count: s.count,
      accuracy: acc,
      answered: st?.answered ?? 0,
      priority: s.count * factor,
      subtopics: allSubtopics(s),
      weak_subtopics: (st?.weak_subtopics ?? []).map((w) => ({
        name: w.name,
        accuracy: w.accuracy,
      })),
    };
  });
  const shares = apportion(rows.map((r) => r.priority), 100);
  return rows.map(({ priority: _p, ...r }, i) => ({ ...r, share: shares[i] }));
}

type Phase = {
  id: string;
  /** 2 haftalık döngüde kaç tam deneme. */
  mockExams: number;
  mix: string;
};

/**
 * Sınav yaklaştıkça konu okuma azalır, soru ve tekrar artar.
 * Eşikler kaba: 60 gün ≈ bir kez baştan sona konu turu, 20 gün ≈ son düzlük.
 */
export function phaseFor(daysLeft: number): Phase {
  if (daysLeft > 60)
    return {
      id: "temel",
      mockExams: 1,
      mix: "görevlerin ~%50'si konu, ~%35'i soru, ~%15'i tekrar",
    };
  if (daysLeft > 20)
    return {
      id: "pekiştirme",
      mockExams: 2,
      mix: "görevlerin ~%30'u konu, ~%45'i soru, ~%25'i tekrar",
    };
  return {
    id: "sınav",
    mockExams: 2,
    mix: "görevlerin ~%10'u konu, ~%50'si soru, ~%40'ı tekrar",
  };
}

function subjectTable(shares: SubjectShare[]): string {
  return shares
    .map(
      (s) =>
        `${s.id} | ${s.name} | sınavda ${s.count} soru | hedef_pay %${s.share} | ` +
        `doğruluk ${s.accuracy === null ? `ölçülmedi (${s.answered} cevap)` : `%${s.accuracy}`}\n` +
        `   alt konular: ${s.subtopics.join(" ; ")}`
    )
    .join("\n");
}

function weakTable(shares: SubjectShare[]): string {
  const rows = shares.flatMap((s) =>
    s.weak_subtopics
      .filter((w) => w.accuracy < 70)
      .map((w) => `${s.id} > ${w.name} — %${w.accuracy}`)
  );
  return rows.length ? rows.join("\n") : "(yeterli veri yok)";
}

const RULES = `KURALLAR:
1. Çıktı SADECE JSON. Markdown code fence yok, açıklama yok.
2. GÜNLER listesindeki tarih ve weekday değerlerini AYNEN kullan; gün ekleme,
   atlama, tarih uydurma yok. "off": true olan güne görev koyma (tasks: []).
3. Görevler study_window_start–study_window_end arasında, aralarında
   break_minutes kadar boşluk. Günlük toplam süre ≈ daily_hours.
4. Blok süreleri: konu 45-60 dk, soru 30-45 dk, tekrar 20-30 dk, deneme 155 dk.
5. task_type ve target_ref ZORUNLU olarak eşleşir:
   - "konu"   → "konular?subject=<alan_id>&konu=<alt_konu>" (konu anlatımını oku)
   - "soru"   → "hmgs?subject=<alan_id>" (o alandan soru çöz)
   - "tekrar" → "tekrar" (yanlışlar kuyruğu)
   - "deneme" → "hmgs?count=${HMGS_TOTAL_QUESTIONS}" (tam deneme, 155 dk)
   Başka target_ref biçimi YOK. PDF, kanun, case bağlantısı YOK.
6. subject alanı: konu/soru görevlerinde ALANLAR tablosundaki id, tekrar ve
   deneme görevlerinde null. Tabloda olmayan id yazarsan görev silinir.
7. <alt_konu> o alanın "alt konular" satırından AYNEN kopyalanacak. Listede
   olmayan ad yazma, kendin konu adı türetme.
8. Zaman dağıtımı hedef_pay yüzdelerine uysun: pay yüksek alan daha çok görev
   alır. Pay, sınav ağırlığı ile zayıflığın çarpımıdır — zaten iyi olunan
   alana saat harcatma.
9. ZAYIF ALT KONULAR listesindekilere öncelik ver.
10. Tam deneme 155 dakika sürer ve yorar: bu planda EN FAZLA <deneme_sayisi>
    tane, ayrı günlere, tercihen hafta sonuna.
11. Tekrar kuyruğunda bekleyen soru varsa haftada en az 2 "tekrar" görevi koy.
12. topic ve tip 3-5 kelimeyi geçmesin (JSON büyümesin). Her göreve v4 uuid.
13. notes'taki kısıtlara uy.`;

const OUTPUT_SHAPE = `ÇIKTI ŞEMASI:
{
  "summary": "1-2 cümle plan özeti",
  "weeks": [
    {
      "week_index": 1,
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "days": [
        {
          "date": "YYYY-MM-DD",
          "weekday": "Pazartesi",
          "tasks": [
            {
              "uuid": "v4-uuid",
              "time_start": "09:00",
              "time_end": "10:00",
              "subject": "borclar",
              "topic": "zamanaşımı",
              "task_type": "konu",
              "target_ref": "konular?subject=borclar&konu=zamanaşımı ve kesilmesi",
              "tip": "kesilme sebepleri"
            },
            {
              "uuid": "v4-uuid",
              "time_start": "10:15",
              "time_end": "11:00",
              "subject": "borclar",
              "topic": "borclar soru",
              "task_type": "soru",
              "target_ref": "hmgs?subject=borclar",
              "tip": null
            },
            {
              "uuid": "v4-uuid",
              "time_start": "11:15",
              "time_end": "11:40",
              "subject": null,
              "topic": "yanlışlar",
              "task_type": "tekrar",
              "target_ref": "tekrar",
              "tip": null
            }
          ]
        }
      ]
    }
  ]
}`;

export function buildPlanPrompt(args: {
  form: FormInput;
  stats: StudyStats;
  today: string;
  days: PlanDay[];
  previous?: { planned: number; done: number } | null;
}): string {
  const { form, stats, today, days, previous } = args;
  const daysLeft = daysBetween(today, form.exam_date);
  const phase = phaseFor(daysLeft);
  const shares = subjectShares(stats);

  const previousLine =
    previous && previous.planned > 0
      ? `ÖNCEKİ PLAN: ${previous.planned} görevin ${previous.done} tanesi yapıldı ` +
        `(%${Math.round((previous.done / previous.planned) * 100)}). ` +
        `Oran %60'ın altındaysa bu planda günlük görev sayısını azalt.`
      : "ÖNCEKİ PLAN: yok.";

  return `Sen HMGS (Hukuk Mesleklerine Giriş Sınavı) hazırlığı için saat-saat çalışma
takvimi üreten bir asistansın. Motivasyon metni değil, TAKVİM üretirsin.

SINAV: ${HMGS_TOTAL_QUESTIONS} soru, 155 dakika, 100 üzerinden ${HMGS_PASS_SCORE} geçme notu.
20 alan vardır ve her alanın sınavdaki soru sayısı sabittir.

BUGÜN: ${today}
SINAV TARİHİ: ${form.exam_date} — ${daysLeft} gün kaldı
FAZ: ${phase.id} → ${phase.mix}
BU PLAN ${days.length} GÜNÜ KAPSAR.

${RULES.replace("<deneme_sayisi>", String(phase.mockExams))}

FORM:
${JSON.stringify(
  {
    daily_hours: form.daily_hours,
    study_window_start: form.study_window_start,
    study_window_end: form.study_window_end,
    break_minutes: form.break_minutes,
    days_off: form.days_off,
    notes: form.notes,
  },
  null,
  0
)}

GÜNLER:
${days.map((d) => `${d.date} ${d.weekday}${d.off ? " [TATİL]" : ""}`).join("\n")}

ALANLAR (id | ad | sınav ağırlığı | hedef pay | doğruluk):
${subjectTable(shares)}

ZAYIF ALT KONULAR (önce bunlar):
${weakTable(shares)}

TEKRAR KUYRUĞU: ${stats.review_due} soru vakti gelmiş.
${previousLine}

${OUTPUT_SHAPE}

YANIT (SADECE JSON):`;
}

// ── Uzak haftalar: kaba bakış ────────────────────────────────────────────

export type OutlookWeek = {
  week_index: number;
  start_date: string;
  end_date: string;
  /** Haftalık saatin alanlara dağılımı; 1 saatin altında pay alan alan yok. */
  focus: Array<{ id: string; name: string; hours: number }>;
  mock_exams: number;
  phase: string;
};

/**
 * Ayrıntılı plandan SONRAKİ haftalar için kaba bakış.
 *
 * NEDEN MODELE SORULMUYOR: saat dağıtımı zaten `subjectShares` ile KODDA
 * hesaplanıyor (ağırlık × zayıflık). Aynı hesabı modele tekrarlatmak hem
 * token harcar hem iki farklı sayı üretme riski taşır. Burada modelin
 * ekleyeceği bir bilgi yok.
 *
 * NEDEN GÜN GÜN DEĞİL: 7 hafta sonrasının saat programını bugünden yapmak
 * anlamsız — o zamana kadar zayıf alanlar değişecek ve plan zaten yeniden
 * üretilecek. Uzak haftada işe yarayan tek bilgi "hangi alana ne kadar".
 */
export function buildOutlook(args: {
  today: string;
  examDate: string;
  detailedWeeks: number;
  dailyHours: number;
  daysOff: string[];
  shares: SubjectShare[];
}): OutlookWeek[] {
  const { today, examDate, detailedWeeks, dailyHours, daysOff, shares } = args;
  const toplamGun = daysBetween(today, examDate);
  const kalanGun = toplamGun - detailedWeeks * 7;
  if (kalanGun <= 0) return [];

  const calisilanGun = Math.max(7 - daysOff.length, 1);
  const haftalikSaat = Math.round(dailyHours * calisilanGun);
  const haftaSayisi = Math.ceil(kalanGun / 7);

  const out: OutlookWeek[] = [];
  for (let i = 0; i < haftaSayisi; i++) {
    const basGun = detailedWeeks * 7 + i * 7;
    const start = addDays(today, basGun);
    // Son hafta sınav gününde biter, tam 7 gün olmayabilir.
    const bitGun = Math.min(basGun + 6, toplamGun);
    const end = addDays(today, bitGun);

    // O haftanın ortasındaki kalan güne göre evre — sınav yaklaştıkça
    // deneme sıklığı artıyor, faz eşikleri phaseFor'da.
    const evre = phaseFor(toplamGun - basGun - 3);

    const saatler = apportion(shares.map((s) => s.share), haftalikSaat);
    const focus = shares
      .map((s, idx) => ({ id: s.id, name: s.name, hours: saatler[idx] }))
      // 0 saat alan alanı listelemek gürültü; o hafta ona sıra gelmiyor.
      .filter((f) => f.hours > 0)
      .sort((a, b) => b.hours - a.hours);

    out.push({
      week_index: detailedWeeks + i + 1,
      start_date: start,
      end_date: end,
      focus,
      mock_exams: evre.mockExams,
      phase: evre.id,
    });
  }
  return out;
}

/** ISO tarihe gün ekler. UTC üzerinden: yaz saati kaymasına takılmasın. */
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
