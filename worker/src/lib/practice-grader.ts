import { DeepSeekProvider } from "./ai-provider";
import { embedQuery, retrieve, type RetrievedChunk } from "./rag";

export type GradeRequest = {
  case_id: string;
  scenario: string;
  ideal_solution: string;
  key_points: string[];
  user_solution: string;
};

export type GradeResponse = {
  score: number; // 0-100
  feedback: string; // markdown
  hit_points: string[];
  missed_points: string[];
  errors: string[];
  ideal_solution: string;
  /** Grading sırasında kullanılan kanun chunk'ları (UI'da gösterilebilir). */
  law_refs?: Array<{ pdf: string; page_start: number; page_end: number }>;
};

/**
 * Pratik olayı değerlendirirken, key_points + scenario üzerinden Vectorize'tan
 * en alakalı KANUN maddesi chunk'larını çeker ve Gemini'ye context olarak verir.
 * Bu sayede grader sadece "ideal_solution + key_points" değil, gerçek
 * kanun metinleriyle de cross-check yapar ve feedback'inde madde referansı verebilir.
 */
async function fetchLawContext(
  ai: Ai | undefined,
  vectorize: VectorizeIndex | undefined,
  scenario: string,
  keyPoints: string[]
): Promise<RetrievedChunk[]> {
  if (!ai || !vectorize) return [];
  try {
    // Senaryo + key_points birleşik bir sorgu
    const queryText = `${scenario}\n\nAnahtar kavramlar: ${keyPoints.join(
      "; "
    )}`;
    const qVec = await embedQuery(queryText, ai);
    return await retrieve(vectorize, qVec, "kanunlar", 6);
  } catch (e) {
    console.warn("law context fetch failed:", e);
    return [];
  }
}

export async function gradeSolution(
  apiKey: string,
  req: GradeRequest,
  ctx?: { ai?: Ai; vectorize?: VectorizeIndex }
): Promise<GradeResponse> {
  // 1) RAG — kanun bağlamı (best-effort, hata olursa boş array)
  const lawChunks = await fetchLawContext(
    ctx?.ai,
    ctx?.vectorize,
    req.scenario,
    req.key_points
  );

  const lawContext = lawChunks.length
    ? `\n\nİLGİLİ KANUN METİNLERİ (otomatik retrieve, kullanırsan feedback'te madde no'su belirt):\n${lawChunks
        .map(
          (c, i) =>
            `[K${i + 1}] ${c.pdf} (s.${c.page_start}-${c.page_end}):\n${c.text}`
        )
        .join("\n\n")}`
    : "";

  const prompt = `Sen Türk hukuk öğretim üyesisin. Öğrencinin pratik olay çözümünü değerlendir.

OLAY:
${req.scenario}

İDEAL ÇÖZÜM (öğrenciye sadece skor verildikten sonra gösterilecek):
${req.ideal_solution}

OLAYDA MUTLAKA DEĞİNİLMESİ GEREKEN KAVRAMLAR:
${req.key_points.map((p, i) => `${i + 1}. ${p}`).join("\n")}
${lawContext}

ÖĞRENCİNİN ÇÖZÜMÜ:
${req.user_solution}

GÖREV: Aşağıdaki JSON formatında değerlendir. SADECE JSON döndür, başka açıklama, markdown code fence YOK.

{
  "score": <0 ile 100 arasında tam sayı; kavramsal doğruluk + yapısal düzgünlük + Türk hukuk terminolojisi kullanımı + ilgili kanun maddelerinin referansı>,
  "feedback": "<Markdown formatında 3-6 cümle öğrenci geri bildirimi. Önce pozitifleri belirt, sonra eksikleri, sonra hatalı yorumları (varsa). EĞER YUKARIDA KANUN METİNLERİ VARSA, ilgili madde numarasını belirterek 'TBK m.49 ... gereği' gibi referans ver. Yapıcı ve teşvik edici ol.>",
  "hit_points": [<öğrencinin doğru yakaladığı key_point'ler — listeden, tam metin kopyala>],
  "missed_points": [<öğrencinin atladığı key_point'ler — listeden, tam metin kopyala>],
  "errors": [<varsa hatalı yorumladığı hukuki kavramlar veya yanlış sonuçlar, kısa cümleler>]
}`;

  const provider = new DeepSeekProvider(apiKey, "deepseek-chat");
  let raw = "";
  for await (const tok of provider.streamChat(prompt)) raw += tok;

  // Code fence temizliği (Gemini bazen ekler)
  raw = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  const law_refs = lawChunks.map((c) => ({
    pdf: c.pdf,
    page_start: c.page_start,
    page_end: c.page_end,
  }));

  try {
    const j = JSON.parse(raw);
    return {
      score: typeof j.score === "number" ? Math.round(j.score) : 50,
      feedback: String(j.feedback ?? ""),
      hit_points: Array.isArray(j.hit_points) ? j.hit_points : [],
      missed_points: Array.isArray(j.missed_points) ? j.missed_points : [],
      errors: Array.isArray(j.errors) ? j.errors : [],
      ideal_solution: req.ideal_solution,
      law_refs,
    };
  } catch {
    // Parse fallback
    return {
      score: 50,
      feedback:
        "AI cevabı düzgün JSON olarak parse edilemedi. Ham çıktı:\n\n```\n" +
        raw.slice(0, 1000) +
        "\n```\n\nLütfen tekrar dene veya çözümünü biraz farklı yaz.",
      hit_points: [],
      missed_points: req.key_points,
      errors: [],
      ideal_solution: req.ideal_solution,
      law_refs,
    };
  }
}
