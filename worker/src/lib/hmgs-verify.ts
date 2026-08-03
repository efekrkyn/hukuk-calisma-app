/**
 * Soru bankası denetimi.
 *
 * Sorular kanun metninden üretiliyor ama üretim doğruluğu garanti etmiyor:
 * denetimde 5510 sorusunun açıklaması kendi kendisiyle çelişiyordu.
 *
 * TASARIM NOTU — bu bir LLM'in LLM'i denetlemesi, kör noktalar ortak olabilir.
 * Riski üç şekilde azaltıyoruz:
 *  1. Hakem modelin HAFIZASINA değil, yeniden çekilen KANUN METNİNE bakıyor.
 *     Metinde karşılığı yoksa "unsupported" diyor, kendi bilgisiyle doldurmuyor.
 *  2. Duruş karşıt: "doğrula" değil, "hatayı bul".
 *  3. Üretim deepseek-chat, denetim deepseek-reasoner — en azından aynı
 *     karar yolu değil.
 * Yine de bu, insan denetiminin yerini tutmaz; şüpheli soruları eleme aracıdır.
 */

import { embedQuery, retrieve } from "./rag";
import { DeepSeekProvider } from "./ai-provider";
import { parseLlmJson } from "./llm-json";
import type { HmgsSubject } from "./hmgs-subjects";

export type QuestionToCheck = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
};

export type Verdict = {
  id: string;
  verdict: "correct" | "wrong" | "unsupported";
  reason: string;
};

const SYSTEM = `Sen bir hukuk sınavı sorularını DENETLEYEN kıdemli hukukçusun.
Görevin soruları onaylamak değil, HATA BULMAK.

Her soru için <KANUN> bölümündeki metne bakarak karar ver:
- "correct"     : Kanun metni, işaretlenen doğru cevabı açıkça destekliyor.
- "wrong"       : Kanun metni farklı bir şıkkı destekliyor VEYA açıklama
                  kendi içinde çelişiyor (bir şeyi söyleyip tersini işaretlemek).
- "unsupported" : Kanun metninde bu soruyu karara bağlayacak hüküm yok.

KURALLAR:
1. YALNIZCA <KANUN> metnine dayan. Kendi hukuk bilginle boşluk DOLDURMA —
   metinde yoksa "unsupported" de. Bu kural denetimin tüm değeri.
2. Açıklamanın kendi içinde tutarlı olup olmadığını ayrıca kontrol et.
3. reason alanına kısa ve somut gerekçe yaz (hangi madde, neden).
4. SADECE JSON dizisi döndür.

FORMAT: [{"id":"...","verdict":"correct","reason":"..."}]`;

export async function verifyBatch(
  env: { AI: Ai; VECTORIZE: VectorizeIndex; DB?: D1Database; DEEPSEEK_API_KEY: string },
  subject: HmgsSubject,
  questions: QuestionToCheck[]
): Promise<Verdict[]> {
  if (questions.length === 0 || subject.lawFiles.length === 0) return [];

  // Kanun metnini soruların kendi içeriğine göre çek — konu başlığına göre
  // değil, yoksa alakasız maddeler gelir ve her şey "unsupported" çıkar.
  const query = questions.map((q) => q.question).join(" ");
  const qVec = await embedQuery(query, env.AI);
  const all = await retrieve(
    env.VECTORIZE, env.DB, query, qVec, env.AI, "kanunlar", 40
  );
  const chunks = all.filter((c) => subject.lawFiles.some((f) => c.pdf.includes(f)));
  if (chunks.length === 0) return [];

  const law = chunks
    .map((c, i) => `[${i + 1}] ${c.pdf} (s.${c.page_start}):\n${c.text}`)
    .join("\n\n");

  const body = questions
    .map(
      (q) =>
        `id: ${q.id}\nSORU: ${q.question}\nŞIKLAR:\n` +
        q.options.map((o, i) => `  ${String.fromCharCode(65 + i)}) ${o}`).join("\n") +
        `\nİŞARETLENEN DOĞRU: ${String.fromCharCode(65 + q.correctAnswer)}\n` +
        `AÇIKLAMA: ${q.explanation}`
    )
    .join("\n\n---\n\n");

  const provider = new DeepSeekProvider(env.DEEPSEEK_API_KEY, "deepseek-reasoner");
  let raw = "";
  for await (const tok of provider.streamChat(
    `<KANUN>\n${law}\n</KANUN>\n\n<SORULAR>\n${body}\n</SORULAR>`,
    SYSTEM
  )) {
    raw += tok;
  }

  const parsed = parseLlmJson<unknown[]>(raw);
  if (!Array.isArray(parsed)) return [];

  const known = new Set(questions.map((q) => q.id));
  const out: Verdict[] = [];
  for (const item of parsed) {
    const v = normalizeVerdict(item);
    // Modelin uydurduğu id'leri alma — yanlış soruyu işaretlemek,
    // hiç işaretlememekten kötü.
    if (v && known.has(v.id)) out.push(v);
  }
  return out;
}

export function normalizeVerdict(item: unknown): Verdict | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const verdict = String(o.verdict ?? "").toLowerCase().trim();
  if (!id) return null;
  if (verdict !== "correct" && verdict !== "wrong" && verdict !== "unsupported") {
    return null;
  }
  return {
    id,
    verdict: verdict as Verdict["verdict"],
    reason: typeof o.reason === "string" ? o.reason.trim().slice(0, 500) : "",
  };
}
