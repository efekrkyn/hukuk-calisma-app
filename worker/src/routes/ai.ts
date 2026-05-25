import { Hono } from "hono";
import { embedQuery, retrieve, buildPrompt } from "../lib/rag";
import { GeminiProvider } from "../lib/ai-provider";
import { gradeSolution } from "../lib/practice-grader";

type Bindings = {
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  GEMINI_KEY: string;
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
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  if (!body.question || typeof body.question !== "string") {
    return c.json({ error: "question (string) required" }, 400);
  }

  // 1) Embed query (selected_text varsa onunla birleştir, daha iyi retrieval)
  const queryText = body.selected_text
    ? `${body.selected_text}\n\nSoru: ${body.question}`
    : body.question;
  const qVec = await embedQuery(queryText, c.env.AI);

  // 2) Retrieve top-K chunks from Vectorize (course filter opsiyonel)
  const chunks = await retrieve(
    c.env.VECTORIZE,
    qVec,
    body.course,
    body.top_k ?? 5
  );

  // 3) Build prompt + stream from Gemini
  const prompt = buildPrompt(body.question, body.selected_text, chunks);
  const provider = new GeminiProvider(c.env.GEMINI_KEY);
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
        for await (const tok of provider.streamChat(prompt)) {
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

  const result = await gradeSolution(c.env.GEMINI_KEY, body);

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
