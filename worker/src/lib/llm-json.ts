/**
 * DeepSeek-reasoner çıktısından JSON söker.
 *
 * İki tuzak var: reasoner cevabın önüne <think>…</think> koyuyor, ve model
 * bazen ```json fence'i ekliyor. İkisi de temizlenmezse JSON.parse patlar.
 */
export function stripLlmJson(raw: string): string {
  let s = raw;

  const thinkEnd = s.lastIndexOf("</think>");
  if (thinkEnd !== -1) s = s.slice(thinkEnd + "</think>".length);

  s = s.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  return s;
}

/** Temizleyip parse eder; başarısızsa null döner (çağıran fallback'ini seçsin). */
export function parseLlmJson<T>(raw: string): T | null {
  try {
    return JSON.parse(stripLlmJson(raw)) as T;
  } catch {
    return null;
  }
}
