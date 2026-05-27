/**
 * AI Provider abstraction — sonradan Claude/OpenAI'ya geçişi 1 dosyaya indirir.
 * Şu an varsayılan: Gemini 2.5 Flash (streaming).
 */

export interface AIProvider {
  streamChat(
    promptOrContents: string | Array<{ role: string; parts: Array<{ text: string }> }>,
    systemInstruction?: string
  ): AsyncGenerator<string>;
}

export class GeminiProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private model = "gemini-2.5-flash"
  ) {}

  async *streamChat(
    promptOrContents: string | Array<{ role: string; parts: Array<{ text: string }> }>,
    systemInstruction?: string
  ): AsyncGenerator<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

    let contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    if (typeof promptOrContents === "string") {
      contents = [{ role: "user", parts: [{ text: promptOrContents }] }];
    } else {
      contents = promptOrContents;
    }

    const body: Record<string, any> = {
      contents,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingBudget: 0 },
      },
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok || !r.body) {
      const err = await r.text();
      console.error(`gemini http ${r.status}:`, err.slice(0, 500));
      throw new Error(`gemini ${r.status}: ${err.slice(0, 300)}`);
    }

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let yieldedAny = false;

    // SSE line-by-line: her "data: ..." satırı tek başına geçerli JSON event.
    // Blank line ayrac yerine direkt satır işleme (daha sağlam).
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // CRLF normalize
      buffer = buffer.replace(/\r\n/g, "\n");

      // Tam satırları işle, son yarım satırı buffer'da bırak
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (!trimmed.startsWith("data: ")) continue;
        const payload = trimmed.slice(6);
        if (payload === "[DONE]") continue;
        try {
          const j = JSON.parse(payload);
          const text = j?.candidates?.[0]?.content?.parts?.[0]?.text as
            | string
            | undefined;
          if (text) {
            yieldedAny = true;
            yield text;
          }
        } catch (e) {
          console.error("gemini SSE parse fail:", payload.slice(0, 200));
        }
      }
    }

    // Son kalan buffer (newline ile bitmemiş son event)
    const last = buffer.trim();
    if (last.startsWith("data: ")) {
      const payload = last.slice(6);
      if (payload && payload !== "[DONE]") {
        try {
          const j = JSON.parse(payload);
          const text = j?.candidates?.[0]?.content?.parts?.[0]?.text as
            | string
            | undefined;
          if (text) {
            yieldedAny = true;
            yield text;
          }
        } catch {
          // ignore
        }
      }
    }

    if (!yieldedAny) {
      console.error("gemini yielded 0 tokens. last buffer:", buffer.slice(0, 500));
    }
  }
}

export class DeepSeekProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private model = "deepseek-v4-pro"
  ) {}

  async *streamChat(
    promptOrContents: string | Array<{ role: string; parts: Array<{ text: string }> }>,
    systemInstruction?: string
  ): AsyncGenerator<string> {
    const url = "https://api.deepseek.com/chat/completions";

    const messages: Array<{ role: string; content: string }> = [];
    if (systemInstruction) {
      messages.push({ role: "system", content: systemInstruction });
    }
    if (typeof promptOrContents === "string") {
      messages.push({ role: "user", content: promptOrContents });
    } else {
      for (const msg of promptOrContents) {
        const role = msg.role === "model" || msg.role === "assistant" ? "assistant" : "user";
        const text = msg.parts.map((p) => p.text).join("\n");
        messages.push({ role, content: text });
      }
    }

    const body: Record<string, any> = {
      model: this.model,
      messages,
      stream: true,
    };

    // Enable thinking parameters for reasoning in deepseek-v4-pro
    if (this.model === "deepseek-v4-pro") {
      body.reasoning_effort = "high";
      body.extra_body = {
        thinking: { type: "enabled" }
      };
    }

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!r.ok || !r.body) {
      const err = await r.text();
      console.error(`deepseek http ${r.status}:`, err.slice(0, 500));
      throw new Error(`deepseek ${r.status}: ${err.slice(0, 300)}`);
    }

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let inThinkingBlock = false;
    let yieldedThinkingStart = false;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, "\n");

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (!trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6);
          if (payload === "[DONE]") continue;

          try {
            const j = JSON.parse(payload);
            const reasoning = j?.choices?.[0]?.delta?.reasoning_content as string | undefined;
            const content = j?.choices?.[0]?.delta?.content as string | undefined;

            if (reasoning) {
              if (!yieldedThinkingStart) {
                yieldedThinkingStart = true;
                inThinkingBlock = true;
                yield "<think>\n";
              }
              yield reasoning;
            } else if (content) {
              if (inThinkingBlock) {
                inThinkingBlock = false;
                yield "\n</think>\n\n";
              }
              yield content;
            }
          } catch (e) {
            // ignore
          }
        }
      }
    } finally {
      if (inThinkingBlock) {
        yield "\n</think>\n\n";
      }
    }
  }
}

