/**
 * Mevcut soruları alt konuya atar.
 *
 * `subtopic` sütunu sonradan eklendi; ondan önce üretilmiş ~3000 soruda bilgi
 * yok. Yeniden üretmek hem pahalı hem gereksiz — sorular sağlam, yalnızca
 * etiketleri eksik. Etiketleme ucuz modelle ve toplu yapılıyor.
 *
 * Model serbest metin uydurabilir; dönen etiket alanın KENDİ listesine karşı
 * doğrulanıyor, eşleşmeyen atlanıyor. Yanlış etiket, etiketsizlikten kötü:
 * "zamanaşımı konusunda zayıfsın" deyip yanlış konuya yönlendirir.
 */
import { DeepSeekProvider } from "./ai-provider";
import { parseLlmJson } from "./llm-json";
import type { HmgsSubject } from "./hmgs-subjects";

export type ToClassify = { id: string; question: string; explanation: string };
export type Assignment = { id: string; subtopic: string };

const SYSTEM = `Sen bir HMGS soru bankasını konu başlıklarına ayıran hukukçusun.

Sana bir alanın ALT KONU listesi ve o alandan sorular verilecek. Her soruyu
listedeki EN UYGUN alt konuya ata.

KURALLAR:
1. YALNIZCA verilen listedeki alt konu adlarını kullan. Yeni başlık UYDURMA,
   listedekini birebir aynı yaz.
2. Bir soru birden çok konuya değiyorsa, sorunun ÖLÇTÜĞÜ asıl konuyu seç —
   geçerken andığı konuyu değil.
3. Hiçbiri gerçekten uymuyorsa o soruyu ATLA, listede olmayan bir şey yazma.
   Eksik etiket, yanlış etiketten iyidir.
4. SADECE JSON dizisi döndür.

FORMAT: [{"id":"...","subtopic":"listeden birebir alt konu adı"}]`;

export function allSubtopics(subject: HmgsSubject): string[] {
  return [...(subject.subtopics ?? []), ...(subject.doctrineSubtopics ?? [])];
}

export async function classifyQuestions(
  apiKey: string,
  subject: HmgsSubject,
  questions: ToClassify[]
): Promise<Assignment[]> {
  const konular = allSubtopics(subject);
  if (konular.length === 0 || questions.length === 0) return [];

  const body =
    `ALAN: ${subject.name}\n\nALT KONULAR:\n` +
    konular.map((k) => `- ${k}`).join("\n") +
    `\n\nSORULAR:\n` +
    questions
      .map((q) => `id: ${q.id}\nSORU: ${q.question}\nAÇIKLAMA: ${q.explanation.slice(0, 300)}`)
      .join("\n\n---\n\n");

  const provider = new DeepSeekProvider(apiKey, "deepseek-chat");
  let raw = "";
  for await (const tok of provider.streamChat(body, SYSTEM)) raw += tok;

  const parsed = parseLlmJson<unknown[]>(raw);
  if (!Array.isArray(parsed)) return [];

  const gecerli = new Set(konular);
  const bilinen = new Set(questions.map((q) => q.id));
  const out: Assignment[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const sub = typeof o.subtopic === "string" ? o.subtopic.trim() : "";
    // Hem id hem etiket doğrulanıyor: model uydurduğu id'ye etiket yazarsa
    // yanlış soruyu etiketlemiş oluruz.
    if (bilinen.has(id) && gecerli.has(sub)) out.push({ id, subtopic: sub });
  }
  return out;
}
