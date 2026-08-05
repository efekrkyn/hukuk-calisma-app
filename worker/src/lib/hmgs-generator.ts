/**
 * HMGS soru üretici.
 *
 * ÖSYM kitapçıklarındaki sorular telifli olduğu için kopyalanmaz. Bunun yerine
 * indexlenmiş kanun metninden RAG ile ÖZGÜN çoktan seçmeli soru üretilir; her
 * sorunun dayandığı kanun/sayfa kaydedilir ki üretilen soru denetlenebilsin.
 */

import { embedQuery, retrieve } from "./rag";
import { DeepSeekProvider } from "./ai-provider";
import { parseLlmJson } from "./llm-json";
import type { HmgsSubject } from "./hmgs-subjects";

export type GeneratedQuestion = {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  /** Modelin bildirdiği <KAYNAK> parça numarası (1 tabanlı); yoksa null. */
  sourceIndex: number | null;
  source_pdf?: string;
  source_page?: number;
};

const SYSTEM = `Sen HUKUK ALANI için soru yazan bir hukukçusun (HMGS — Hukuk Mesleklerine Giriş Sınavı).

KURALLAR:
1. Yalnızca <KAYNAK> içindeki kanun metnine dayanan sorular yaz. Kaynakta olmayan bilgiyi UYDURMA.
2. Sorular ÖZGÜN olacak — ezberden herhangi bir çıkmış sınav sorusunu tekrar etme.
3. Her soru 4 şıklı, tek doğru cevaplı olacak. Çeldiriciler makul olmalı; "hepsi/hiçbiri" kullanma.
4. HMGS seviyesi: maddenin uygulanmasını ölçen, olaya dayalı veya karşılaştırmalı sorular tercih et.
5. explanation alanında doğru cevabın dayandığı kanun maddesini belirt.
5b. ŞIK UZUNLUKLARI BİRBİRİNE YAKIN OLSUN. Doğru şıkkı diğerlerinden daha uzun
   veya daha ayrıntılı yazma — uzunluk cevabı ele verir, soru ölçmez olur.
5c. Doğru cevabı şıklar arasında rastgele konumlandır, hep aynı harfe koyma.
6. sourceIndex: soruyu hangi <KAYNAK> parçasından yazdığını [n] numarasıyla bildir.
7. İSTENEN ALAN DIŞINA ÇIKMA. Kaynak parçaları istenen alanı karşılamıyorsa o soruyu
   hiç yazma — az soru döndürmek, yanlış alandan soru döndürmekten iyidir.
8. SADECE JSON dizisi döndür, başka hiçbir metin yazma.

FORMAT:
[{"question":"...","options":["...","...","...","..."],"correctAnswer":0,"explanation":"...","sourceIndex":1}]`;

/** Üretilen ham nesneyi doğrular; şema bozuksa null döner. */
export function validateQuestion(q: unknown): GeneratedQuestion | null {
  if (!q || typeof q !== "object") return null;
  const o = q as Record<string, unknown>;

  const question = typeof o.question === "string" ? o.question.trim() : "";
  const explanation = typeof o.explanation === "string" ? o.explanation.trim() : "";
  const options = Array.isArray(o.options) ? o.options.map((x) => String(x).trim()) : [];

  // Number(null) ve Number("") 0 döner — cevap anahtarı olmayan soru sessizce
  // "doğru cevap A" olarak kaydedilirdi. Sayı veya sayısal string dışını reddet.
  const rawAnswer = o.correctAnswer;
  const isNumeric =
    typeof rawAnswer === "number" ||
    (typeof rawAnswer === "string" && rawAnswer.trim() !== "");
  const correctAnswer = isNumeric ? Number(rawAnswer) : NaN;

  if (question.length < 15) return null;
  if (options.length !== 4 || options.some((x) => x.length === 0)) return null;
  if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) return null;
  if (new Set(options).size !== 4) return null; // aynı şık iki kez olmasın
  if (explanation.length < 10) return null;

  // UZUNLUK KAPISI. Bankada doğru şık %47 oranında en uzun olandı (şans %25):
  // soru okunmadan cevap seçilebiliyordu. Prompt'a kural eklemek yetmedi,
  // mekanik kapı gerekiyor.
  //
  // Eşik gerçek bankadan kalibre edildi: 1.4'te iz %47 → %28'e (şans
  // seviyesi) düşüyor, üretimin ~%25'i eleniyor. Daha sıkı eşik (1.3) çok
  // sağlam soruyu da atıyordu.
  const otherLens = options.filter((_, i) => i !== correctAnswer).map((o) => o.length);
  const meanOther = otherLens.reduce((a, b) => a + b, 0) / otherLens.length;
  if (meanOther > 0 && options[correctAnswer].length / meanOther > 1.4) return null;

  const idx = Number(o.sourceIndex);
  const sourceIndex = Number.isInteger(idx) && idx >= 1 ? idx : null;

  return { question, options, correctAnswer, explanation, sourceIndex };
}

export async function generateQuestions(
  env: { AI: Ai; VECTORIZE: VectorizeIndex; DB?: D1Database; DEEPSEEK_API_KEY: string },
  subject: HmgsSubject,
  count: number
): Promise<GeneratedQuestion[]> {
  // Doktrin konularında kanun yok; makale korpusundan besleniyorlar.
  // Ne kanun ne makale kaynağı varsa üretme — dayanaksız soru uydurma olur.
  const course = subject.ragCourse ?? "kanunlar";
  if (subject.lawFiles.length === 0 && !subject.ragCourse) return [];

  // 1) Alanın konusuyla ilgili kanun metnini çek. "kanunlar" course'u 23 kanun
  //    içerdiği için geniş alıp alanın kendi kanunlarına daraltıyoruz.
  //
  // ALT KONU ROTASYONU: sabit sorgu her seferinde aynı chunk'ları getiriyordu.
  // Denetimde Borçlar'da 46 sorunun yalnızca 13 farklı kanun parçasından
  // üretildiği görüldü — aynı maddeler dönüp duruyordu. Rastgele bir alt
  // konu seçmek retrieval'ı kanunun farklı yerlerine taşıyor.
  const subtopic =
    subject.subtopics?.length
      ? subject.subtopics[Math.floor(Math.random() * subject.subtopics.length)]
      : "";
  const query = `${subject.name}: ${subtopic || subject.topic}`;
  const qVec = await embedQuery(query, env.AI);
  const all = await retrieve(
    env.VECTORIZE, env.DB, query, qVec, env.AI, course, Math.max(count * 8, 40)
  );

  // lawFiles boşsa (doktrin konusu) course filtresi zaten daraltıyor,
  // dosya bazlı çapa uygulanmaz.
  const chunks = subject.lawFiles.length
    ? all.filter((c) => subject.lawFiles.some((f) => c.pdf.includes(f)))
    : all;

  // Doğru kanundan hiç parça gelmediyse başka kanundan soru üretmektense hiç üretme.
  if (chunks.length === 0) return [];

  const context = chunks
    .map((c, i) => `[${i + 1}] ${c.pdf} (s.${c.page_start}):\n${c.text}`)
    .join("\n\n");

  // Bankada ne olduğunu söylemezsek model aynı soruyu tekrar üretiyor
  // (denetimde Medeni Hukuk'ta aynı soru 3 kez çıktı).
  let avoid = "";
  if (env.DB) {
    try {
      const prev = await env.DB.prepare(
        `SELECT question FROM hmgs_questions WHERE subject = ? ORDER BY created_at DESC LIMIT 25`
      ).bind(subject.id).all<{ question: string }>();
      if (prev.results.length > 0) {
        avoid =
          "\n\n<ZATEN_VAR>\nBu sorular bankada mevcut, bunları veya çok benzerlerini TEKRAR YAZMA:\n" +
          prev.results.map((r, i) => `${i + 1}. ${r.question}`).join("\n") +
          "\n</ZATEN_VAR>";
      }
    } catch (e) {
      console.error("mevcut sorular okunamadı:", e);
    }
  }

  const prompt = `<KAYNAK>\n${context}\n</KAYNAK>${avoid}\n\nYukarıdaki kanun metnine dayanarak "${subject.name}"${subtopic ? ` alanında, özellikle "${subtopic}" konusunda` : " alanında"} ${count} adet HMGS sorusu yaz.`;

  const provider = new DeepSeekProvider(env.DEEPSEEK_API_KEY, "deepseek-chat");
  let raw = "";
  for await (const tok of provider.streamChat(prompt, SYSTEM)) raw += tok;

  const parsed = parseLlmJson<unknown[]>(raw);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map(validateQuestion)
    .filter((q): q is GeneratedQuestion => q !== null)
    // Kaynağını bildirmeyen veya var olmayan bir parçayı gösteren soruyu alma:
    // dayanağı doğrulanamayan soru bankaya girerse hatayı sonradan bulmak imkânsız.
    .filter((q) => q.sourceIndex !== null && q.sourceIndex <= chunks.length)
    .slice(0, count)
    .map((q) => {
      const src = chunks[q.sourceIndex! - 1];
      return { ...q, source_pdf: src.pdf, source_page: src.page_start };
    });
}
