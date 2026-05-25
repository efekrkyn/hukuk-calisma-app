/**
 * AI Provider abstraction — sonradan Claude/OpenAI'ya geçişi 1 dosyaya indirir.
 * Şu an varsayılan: Gemini 2.5 Flash (streaming).
 */

export interface AIProvider {
  streamChat(prompt: string): AsyncGenerator<string>;
}

export class GeminiProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private model = "gemini-2.5-flash"
  ) {}

  async *streamChat(prompt: string): AsyncGenerator<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }),
    });
    if (!r.ok || !r.body) {
      const err = await r.text();
      throw new Error(`gemini ${r.status}: ${err.slice(0, 300)}`);
    }

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const ev of events) {
        const dataLine = ev
          .split("\n")
          .find((l) => l.startsWith("data: "))
          ?.slice(6)
          .trim();
        if (!dataLine || dataLine === "[DONE]") continue;
        try {
          const j = JSON.parse(dataLine);
          const text = j?.candidates?.[0]?.content?.parts?.[0]?.text as
            | string
            | undefined;
          if (text) yield text;
        } catch {
          // partial chunk, ignore
        }
      }
    }
  }
}
