import { GeminiProvider } from "./ai-provider";

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
};

export async function gradeSolution(
  apiKey: string,
  req: GradeRequest
): Promise<GradeResponse> {
  const prompt = `Sen Türk hukuk öğretim üyesisin. Öğrencinin pratik olay çözümünü değerlendir.

OLAY:
${req.scenario}

İDEAL ÇÖZÜM (öğrenciye sadece skor verildikten sonra gösterilecek):
${req.ideal_solution}

OLAYDA MUTLAKA DEĞİNİLMESİ GEREKEN KAVRAMLAR:
${req.key_points.map((p, i) => `${i + 1}. ${p}`).join("\n")}

ÖĞRENCİNİN ÇÖZÜMÜ:
${req.user_solution}

GÖREV: Aşağıdaki JSON formatında değerlendir. SADECE JSON döndür, başka açıklama, markdown code fence YOK.

{
  "score": <0 ile 100 arasında tam sayı; kavramsal doğruluk + yapısal düzgünlük + Türk hukuk terminolojisi kullanımı>,
  "feedback": "<Markdown formatında 3-6 cümle öğrenci geri bildirimi. Önce pozitifleri belirt, sonra eksikleri, sonra hatalı yorumları (varsa). Yapıcı ve teşvik edici ol.>",
  "hit_points": [<öğrencinin doğru yakaladığı key_point'ler — listeden, tam metin kopyala>],
  "missed_points": [<öğrencinin atladığı key_point'ler — listeden, tam metin kopyala>],
  "errors": [<varsa hatalı yorumladığı hukuki kavramlar veya yanlış sonuçlar, kısa cümleler>]
}`;

  const provider = new GeminiProvider(apiKey);
  let raw = "";
  for await (const tok of provider.streamChat(prompt)) raw += tok;

  // Code fence temizliği (Gemini bazen ekler)
  raw = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    const j = JSON.parse(raw);
    return {
      score: typeof j.score === "number" ? Math.round(j.score) : 50,
      feedback: String(j.feedback ?? ""),
      hit_points: Array.isArray(j.hit_points) ? j.hit_points : [],
      missed_points: Array.isArray(j.missed_points) ? j.missed_points : [],
      errors: Array.isArray(j.errors) ? j.errors : [],
      ideal_solution: req.ideal_solution,
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
    };
  }
}
