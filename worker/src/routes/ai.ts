import { Hono } from "hono";
import { embedQuery, retrieve, buildPrompt, buildSystemPrompt } from "../lib/rag";
import { DeepSeekProvider } from "../lib/ai-provider";
import { gradeSolution } from "../lib/practice-grader";

type Bindings = {
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  GEMINI_KEY: string;
  DEEPSEEK_API_KEY?: string;
  DB?: D1Database;
};

export const ai = new Hono<{ Bindings: Bindings }>();

ai.post("/chat", async (c) => {
  let body: {
    question: string;
    selected_text?: string;
    course?: string;
    pdf_key?: string;
    top_k?: number;
    mode?: "default" | "law";
    model?: string;
    history?: Array<{ role: "user" | "model" | "assistant" | "ai"; content: string }>;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  if (!body.question || typeof body.question !== "string") {
    return c.json({ error: "question (string) required" }, 400);
  }

  const mode = body.mode === "law" ? "law" : "default";

  // 1) Embed query (selected_text varsa onunla birleştir, daha iyi retrieval)
  const queryText = body.selected_text
    ? `${body.selected_text}\n\nSoru: ${body.question}`
    : body.question;
  const qVec = await embedQuery(queryText, c.env.AI);

  // 2) Retrieve top-K chunks from Vectorize.
  // Kanun modunda: top_k'yi büyüt (kanun chunks kısa olduğu için daha fazla bağlam).
  // Course filter: mode="law" → "kanunlar" zorlanır (course param görmezden gelinir).
  //                default → body.course ve "kanunlar" beraber aranır (cross-course).
  let filterCourse: string | string[] | undefined = undefined;
  if (mode === "law") {
    filterCourse = "kanunlar";
  } else if (body.course) {
    filterCourse = body.course === "kanunlar" ? "kanunlar" : [body.course, "kanunlar"];
  }

  const topK = body.top_k ?? (mode === "law" ? 8 : 5);
  const chunks = await retrieve(c.env.VECTORIZE, qVec, filterCourse, topK);

  // 3) Build contents list + system instruction
  const systemInstruction = buildSystemPrompt(body.selected_text, chunks, mode);

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  if (body.history && Array.isArray(body.history)) {
    for (const msg of body.history) {
      if (!msg.content || !msg.role) continue;
      contents.push({
        role: msg.role === "ai" || msg.role === "model" || msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }]
      });
    }
  }
  contents.push({
    role: "user",
    parts: [{ text: body.question }]
  });

  const selectedModel = "deepseek-chat";
  if (!c.env.DEEPSEEK_API_KEY) {
    return c.json({ error: "DEEPSEEK_API_KEY env secret not configured" }, 503);
  }
  const provider = new DeepSeekProvider(c.env.DEEPSEEK_API_KEY, selectedModel);
  const encoder = new TextEncoder();
  let fullAnswer = "";

  const stream = new ReadableStream({
    async start(controller) {
      // SSE event: sources (önce kaynakları gönder)
      const sources = chunks.map((ch) => ({
        pdf: ch.pdf,
        page_start: ch.page_start,
        page_end: ch.page_end,
        score: ch.score,
      }));
      controller.enqueue(
        encoder.encode(`event: sources\ndata: ${JSON.stringify(sources)}\n\n`)
      );

      try {
        for await (const tok of provider.streamChat(contents, systemInstruction)) {
          fullAnswer += tok;
          controller.enqueue(
            encoder.encode(`event: token\ndata: ${JSON.stringify(tok)}\n\n`)
          );
        }
        controller.enqueue(encoder.encode(`event: done\ndata: ok\n\n`));
      } catch (e) {
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify(String(e))}\n\n`
          )
        );
      }

      // 4) Persist chat to D1 (best-effort, ignore errors)
      if (c.env.DB && fullAnswer) {
        try {
          await c.env.DB.prepare(
            `INSERT INTO chat_history (id, course, pdf_key, selected_text, question, answer, sources, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
            .bind(
              crypto.randomUUID(),
              body.course ?? null,
              body.pdf_key ?? null,
              body.selected_text ?? null,
              body.question,
              fullAnswer,
              JSON.stringify(sources),
              Date.now()
            )
            .run();
        } catch (e) {
          console.error("chat_history persist:", e);
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});

// Pratik olay grading endpoint
ai.post("/practice-grade", async (c) => {
  let body: {
    case_id: string;
    scenario: string;
    ideal_solution: string;
    key_points: string[];
    user_solution: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  if (!body.user_solution || body.user_solution.trim().length < 20) {
    return c.json(
      { error: "Çözümün en az 20 karakter olmalı." },
      400
    );
  }

  if (
    !body.scenario ||
    !body.ideal_solution ||
    !Array.isArray(body.key_points)
  ) {
    return c.json({ error: "missing case data" }, 400);
  }

  const result = await gradeSolution(c.env.GEMINI_KEY, body, {
    ai: c.env.AI,
    vectorize: c.env.VECTORIZE,
  });

  // Persist to D1 (best-effort)
  if (c.env.DB) {
    try {
      await c.env.DB.prepare(
        `INSERT INTO practice_responses (id, case_id, user_solution, ai_feedback, score, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(
          crypto.randomUUID(),
          body.case_id,
          body.user_solution,
          JSON.stringify(result),
          result.score,
          Date.now()
        )
        .run();
    } catch (e) {
      console.error("practice_responses persist:", e);
    }
  }

  return c.json(result);
});

// Dilekçe & Sözleşme Laboratuvarı Endpoint
ai.post("/dilekce", async (c) => {
  let body: {
    documentType: string;
    details: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  if (!body.documentType || !body.details) {
    return c.json({ error: "documentType and details are required" }, 400);
  }

  const systemInstruction = `Sen profesyonel, 20 yıllık tecrübeli bir Türk Avukatsın.
Senden istenen hukuki metni (dilekçe, sözleşme veya ihtarname) HMK'ya (Hukuk Muhakemeleri Kanunu) ve ilgili maddi hukuk kurallarına (TMK, TBK vs.) tam uygun olarak hazırlamalısın.
Dilekçelerde; Görevli ve Yetkili Mahkeme, Davacı, Davalı, Konu, Açıklamalar, Hukuki Nedenler, Deliller, Sonuç ve İstem bölümlerinin eksiksiz ve resmi bir dille yazıldığından emin ol.
Boş bırakılması gereken yerleri (İsim, T.C. Kimlik No vs.) [.....] şeklinde bırak.
Sadece talep edilen metni oluştur, ekstra sohbet etme.`;

  const prompt = `Lütfen aşağıdaki detaylara göre bir ${body.documentType} taslağı hazırla.
Detaylar:
${body.details}`;

  const apiKey = c.env.DEEPSEEK_API_KEY ?? c.env.GEMINI_KEY;
  const provider = new DeepSeekProvider(apiKey ?? "", "deepseek-chat");
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const tok of provider.streamChat(prompt, systemInstruction)) {
          controller.enqueue(
            encoder.encode(`event: token\ndata: ${JSON.stringify(tok)}\n\n`)
          );
        }
        controller.enqueue(encoder.encode(`event: done\ndata: ok\n\n`));
      } catch (e) {
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify(String(e))}\n\n`
          )
        );
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});

// Dinamik Soru Üretici Endpoint (JSON Mode)
ai.post("/generate-quiz", async (c) => {
  let body: {
    course: string;
    topic: string;
    count: number;
    difficulty: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  if (!body.course || !body.topic) {
    return c.json({ error: "course and topic are required" }, 400);
  }

  const count = body.count || 5;
  const difficulty = body.difficulty || "Orta";

  const systemInstruction = `Sen uzman bir Türk hukuk profesörüsün. Senden çoktan seçmeli, zorluk seviyesi "${difficulty}" olan tam olarak ${count} adet hukuk sorusu üretmen isteniyor.
Üreteceğin soruların konusu: "${body.course} - ${body.topic}".
Cevabın SADECE geçerli bir JSON array olmalıdır. Başka hiçbir açıklama, markdown veya metin yazma. Sadece [ ile başlayıp ] ile biten bir JSON array döndür.
Her soru şu formatta olmalı:
[
  {
    "question": "Soru metni buraya",
    "options": ["A şıkkı", "B şıkkı", "C şıkkı", "D şıkkı", "E şıkkı"],
    "correctAnswer": 2,
    "explanation": "Doğru cevabın hukuki gerekçesi ve açıklaması"
  }
]`;

  const apiKey = c.env.DEEPSEEK_API_KEY ?? c.env.GEMINI_KEY;
  const provider = new DeepSeekProvider(apiKey ?? "", "deepseek-chat");
  
  try {
    let fullText = "";
    for await (const tok of provider.streamChat("Lütfen JSON formatında soruları üret.", systemInstruction)) {
      fullText += tok;
    }
    
    if (!fullText || fullText.trim().length < 10) {
      console.error("Quiz generation: empty response from AI");
      return c.json({ error: "Yapay zeka boş yanıt döndü. Lütfen tekrar deneyin." }, 500);
    }

    // JSON'u çıkar - birden fazla yöntem dene
    let cleanedText = fullText
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    
    // JSON array'i bulmak için regex kullan
    const jsonMatch = cleanedText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      cleanedText = jsonMatch[0];
    }

    const parsed = JSON.parse(cleanedText);
    
    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.error("Quiz generation: parsed result is not a valid array", typeof parsed);
      return c.json({ error: "Yapay zeka geçerli format döndüremedi." }, 500);
    }

    return c.json(parsed);
  } catch (e) {
    console.error("Quiz generation error:", e);
    return c.json({ error: `Sorular üretilemedi: ${String(e).slice(0, 200)}` }, 500);
  }
});

// Canlı Not Analizi (Metin okuyup Soru Çıkarma)
ai.post("/analyze-notes", async (c) => {
  let body: {
    notesText: string;
    count: number;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  if (!body.notesText || body.notesText.trim().length < 50) {
    return c.json({ error: "Lütfen en az 50 karakterlik bir metin girin." }, 400);
  }

  const systemInstruction = `Sen bir hukuk sınavı hazırlayıcısısın. Kullanıcı sana uzun bir ders notu verecek. Senden bu ders notunu dikkatlice okuyup, içindeki BİLGİLERE dayanarak ${body.count || 3} adet çoktan seçmeli soru hazırlaman isteniyor.
Cevabın SADECE geçerli bir JSON array olmalıdır. Başka hiçbir açıklama yazma.
[
  {
    "question": "Soru metni",
    "options": ["A", "B", "C", "D", "E"],
    "correctAnswer": 0,
    "explanation": "Neden A şıkkının doğru olduğuna dair nottan alıntı yaparak açıklama"
  }
]`;

  const apiKey = c.env.DEEPSEEK_API_KEY ?? c.env.GEMINI_KEY;
  const provider = new DeepSeekProvider(apiKey ?? "", "deepseek-chat");
  
  try {
    let fullText = "";
    for await (const tok of provider.streamChat(`İşte ders notu:\n\n${body.notesText}`, systemInstruction)) {
      fullText += tok;
    }
    
    if (!fullText || fullText.trim().length < 10) {
      console.error("Notes analysis: empty response from AI");
      return c.json({ error: "Yapay zeka boş yanıt döndü. Lütfen tekrar deneyin." }, 500);
    }

    let cleanedText = fullText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const jsonMatch = cleanedText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      cleanedText = jsonMatch[0];
    }
    const parsed = JSON.parse(cleanedText);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.error("Notes analysis: parsed result is not a valid array");
      return c.json({ error: "Yapay zeka geçerli format döndüremedi." }, 500);
    }
    return c.json(parsed);
  } catch (e) {
    console.error("Notes analysis error:", e);
    return c.json({ error: "Notlardan soru çıkarılamadı." }, 500);
  }
});

// IRAC Olay Çözme Puanlama
ai.post("/irac-grade", async (c) => {
  let body: {
    scenario: string;
    answers: { issue: string; rule: string; analysis: string; conclusion: string };
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  if (!body.scenario || typeof body.scenario !== "string") {
    return c.json({ error: "scenario (string) required" }, 400);
  }
  if (!body.answers || typeof body.answers !== "object") {
    return c.json({ error: "answers object required" }, 400);
  }
  // Eksik alanları boş string'e normalize et — prompt template yine çalışsın.
  body.answers = {
    issue: typeof body.answers.issue === "string" ? body.answers.issue : "",
    rule: typeof body.answers.rule === "string" ? body.answers.rule : "",
    analysis: typeof body.answers.analysis === "string" ? body.answers.analysis : "",
    conclusion: typeof body.answers.conclusion === "string" ? body.answers.conclusion : "",
  };

  const systemInstruction = `Sen deneyimli bir hukuk profesörüsün. Öğrenciye bir hukuki olay verilmiş ve öğrenci bu olayı IRAC metodu ile 4 adımda çözmüş.
Senden her adımı (issue, rule, analysis, conclusion) 0-100 puan arasında puanlamanı ve her adım için kısa ama yapıcı bir geri bildirim yazmanı istiyoruz.
Ayrıca genel bir puan (overall, 0-100) ve genel bir değerlendirme (overallFeedback) ver.

Cevabın SADECE geçerli bir JSON objesi olmalıdır:
{
  "scores": { "issue": 75, "rule": 60, "analysis": 80, "conclusion": 70 },
  "feedback": { "issue": "...", "rule": "...", "analysis": "...", "conclusion": "..." },
  "overall": 72,
  "overallFeedback": "Genel değerlendirme metni"
}`;

  const prompt = `OLAY:
${body.scenario}

ÖĞRENCİNİN CEVAPLARI:
1. ISSUE (Hukuki Sorun): ${body.answers.issue || "(Boş bırakıldı)"}
2. RULE (Uygulanacak Kural): ${body.answers.rule || "(Boş bırakıldı)"}
3. ANALYSIS (Olaya Uygulama): ${body.answers.analysis || "(Boş bırakıldı)"}
4. CONCLUSION (Sonuç): ${body.answers.conclusion || "(Boş bırakıldı)"}

Lütfen her adımı puanla ve geri bildirim ver. JSON formatında cevap ver.`;

  const apiKey = c.env.DEEPSEEK_API_KEY ?? c.env.GEMINI_KEY;
  const provider = new DeepSeekProvider(apiKey ?? "", "deepseek-chat");

  try {
    let fullText = "";
    for await (const tok of provider.streamChat(prompt, systemInstruction)) {
      fullText += tok;
    }
    const cleanedText = fullText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanedText);
    return c.json(parsed);
  } catch (e) {
    console.error("IRAC grading error:", e);
    return c.json({ error: "Puanlama yapılamadı." }, 500);
  }
});


