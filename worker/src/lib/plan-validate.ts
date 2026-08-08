import { HMGS_SUBJECTS, HMGS_TOTAL_QUESTIONS, getSubject } from "./hmgs-subjects";
import { allSubtopics } from "./hmgs-classify";
import { weekdayOf } from "./plan-prompt";
import type { AiOutput, Task } from "./plan-schemas";

/**
 * Plan hedeflerinin doğrulanması.
 *
 * Model uydurma alan id'si ("deniz_ticaret") ya da uydurma alt konu adı
 * ("TBK m.49 haksız fiil") yazabiliyor. Kaydetmeden önce her görevin hedefi
 * HMGS_SUBJECTS'e karşı denetlenir ve hedef metni modelin yazdığından değil,
 * BURADAN üretilir: tek bir doğru biçim vardır, model onu yanlış yazsa da
 * (fazladan "/", eksik parametre, url-encode) bağlantı bozulmaz.
 *
 * Tercih — geçersiz hedef bulununca:
 *  · alan id'si tanınmıyorsa GÖREV DÜŞER. Alan, görevin taşıyıcı bilgisi:
 *    "hangi alana çalışılacak" yanlışsa geriye kalan saat bloğu sınavda
 *    olmayan bir konuya ayrılmış demektir. Hedefi temizleyip görevi bırakmak
 *    kullanıcıya "bu saatte şuna çalış" der ama neye çalışacağını söylemez.
 *  · alan geçerli, alt konu tanınmıyorsa GÖREV KALIR, hedef alan düzeyine
 *    iner (`konular?subject=medeni`). Konu anlatımı sayfası alan verilip konu
 *    verilmediğinde o alanın konu listesini açıyor — çalışma niyeti korunur,
 *    yalnızca nokta atışı kaybolur. Burada görevi düşürmek, doğru alandaki
 *    çalışmayı yazım hatası yüzünden silmek olurdu.
 */

export type SanitizeResult = {
  output: AiOutput;
  /** Alanı tanınmadığı için düşen görev sayısı. */
  dropped: number;
  /** Hedefi düzeltilen (alt konu düşürülen veya biçimi onarılan) görev sayısı. */
  repaired: number;
};

/** Türkçe büyük/küçük harf ve boşluk oynamalarına dayanıklı karşılaştırma anahtarı. */
function norm(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr");
}

/**
 * Alan id'si → (normalize alt konu → kanonik alt konu).
 *
 * Liste `allSubtopics` üzerinden kuruluyor: konu anlatımı sayfası ve soru
 * sınıflandırıcı da aynı fonksiyonu kullanıyor, "geçerli alt konu" tanımı üç
 * yerde ayrışırsa plan var olmayan bir konuya bağlantı verir.
 */
const SUBTOPIC_INDEX = new Map<string, Map<string, string>>(
  HMGS_SUBJECTS.map((s) => [s.id, new Map(allSubtopics(s).map((t) => [norm(t), t]))])
);

/** Modelin yazdığı alt konu adını alanın kendi listesine oturt; oturmazsa null. */
export function canonicalSubtopic(subjectId: string, raw: string | null): string | null {
  if (!raw) return null;
  return SUBTOPIC_INDEX.get(subjectId)?.get(norm(raw)) ?? null;
}

/** `konular?subject=x&konu=y` gibi bir hedeften parametreleri çıkar. */
function paramsOf(ref: string | null): URLSearchParams {
  if (!ref) return new URLSearchParams();
  const q = ref.indexOf("?");
  return new URLSearchParams(q === -1 ? "" : ref.slice(q + 1));
}

/**
 * Görevin hedefini yeniden üretir.
 * `null` dönmesi "bu görev düşsün" demektir.
 */
export function canonicalTask(task: Task): Task | null {
  const ref = paramsOf(task.target_ref ?? null);
  // Alan bilgisi önce görevin kendi alanından, yoksa hedefteki parametreden.
  const subjectId = (task.subject ?? ref.get("subject") ?? "").trim();
  const subject = subjectId ? getSubject(subjectId) : undefined;

  switch (task.task_type) {
    case "soru":
      if (!subject) return null;
      // Başlık da modelden GÜVENİLMİYOR. Model buraya ham alan kimliği
      // yazıyordu ve ekranda "anayasa_yargisi soru", "borclar soru" gibi
      // çıkıyordu. Soru görevinde başlık tahmin edilebilir, kodda üretiliyor.
      return {
        ...task,
        subject: subject.id,
        topic: `${subject.name} soruları`,
        target_ref: `hmgs?subject=${subject.id}`,
      };

    case "konu": {
      if (!subject) return null;
      const konu = canonicalSubtopic(subject.id, ref.get("konu"));
      return {
        ...task,
        subject: subject.id,
        target_ref: konu
          ? `konular?subject=${subject.id}&konu=${encodeURIComponent(konu)}`
          : `konular?subject=${subject.id}`,
      };
    }

    case "tekrar":
      return { ...task, subject: null, topic: "Yanlışlarım", target_ref: "tekrar" };

    case "deneme":
      return {
        ...task,
        subject: null,
        topic: "Tam deneme",
        target_ref: `hmgs?count=${HMGS_TOTAL_QUESTIONS}`,
      };

    case "serbest":
      // Kullanıcının elle eklediği görev; hedefi yok, olmaması normal.
      return { ...task, subject: null, target_ref: null };
  }
}

/**
 * Sayaç için karşılaştırma anahtarı.
 *
 * Kanonik hedef alt konuyu url-encode ediyor; modelin düz yazdığı aynı hedef
 * bu yüzden "onarıldı" sayılırdı ve sayaç her konu görevinde artardı. Sayacın
 * söylemesi gereken şey biçim değil NİYET değişikliği: hangi alan, hangi konu.
 */
function refKey(ref: string | null): string {
  if (!ref) return "";
  try {
    return decodeURIComponent(ref);
  } catch {
    return ref;
  }
}

export function sanitizePlan(output: AiOutput): SanitizeResult {
  let dropped = 0;
  let repaired = 0;

  const weeks = output.weeks.map((w) => ({
    ...w,
    days: w.days.map((d) => {
      const tasks: Task[] = [];
      for (const t of d.tasks) {
        const fixed = canonicalTask(t);
        if (!fixed) {
          dropped++;
          continue;
        }
        if (refKey(fixed.target_ref) !== refKey(t.target_ref) || fixed.subject !== t.subject) {
          repaired++;
        }
        tasks.push(fixed);
      }
      // weekday tarihten yeniden hesaplanıyor: takvim ızgarası günleri gün
      // adına göre sütuna yerleştiriyor, model "Salı"yı bir günü kaydırıp
      // yazdığında o gün ızgaradan sessizce düşüyordu.
      return { ...d, weekday: weekdayOf(d.date), tasks };
    }),
  }));

  return { output: { ...output, weeks }, dropped, repaired };
}
