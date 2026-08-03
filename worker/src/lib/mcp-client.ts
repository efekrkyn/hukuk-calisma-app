/**
 * Minimal MCP (Model Context Protocol) istemcisi.
 *
 * case-law.ts içinde yargimcp'ye sabitlenmiş hâlde duruyordu; mevzuat MCP'si
 * de eklenince aynı el sıkışma ikinci kez yazılacaktı. URL parametreli tek
 * yere alındı.
 *
 * Akış: initialize (session id başlıkta döner) → initialized bildirimi →
 * tools/call. Yanıt SSE ("data: {...}") veya düz JSON gelebiliyor.
 */

/** Yanıt SSE ise data satırını, değilse gövdeyi JSON olarak çözer. */
export function parseMcp(text: string): any {
  if (text.includes("data:")) {
    const dataLine = text.split("\n").find((l) => l.trimStart().startsWith("data:"));
    if (!dataLine) throw new Error("SSE içinde data satırı yok");
    return JSON.parse(dataLine.trimStart().slice(5).trim());
  }
  return JSON.parse(text);
}

const COMMON_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};

export async function callMcpTool(
  serverUrl: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<any> {
  // 1) initialize — session id yanıt BAŞLIĞINDA geliyor
  const initResp = await fetch(serverUrl, {
    method: "POST",
    headers: COMMON_HEADERS,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "hukuk-worker", version: "1.0" },
      },
    }),
  });
  if (!initResp.ok) {
    throw new Error(`MCP init ${initResp.status}: ${(await initResp.text()).slice(0, 200)}`);
  }

  const sessionId = initResp.headers.get("mcp-session-id");
  if (!sessionId) throw new Error("MCP el sıkışması: mcp-session-id başlığı yok");

  const withSession = { ...COMMON_HEADERS, "Mcp-Session-Id": sessionId };

  // 2) initialized bildirimi
  await fetch(serverUrl, {
    method: "POST",
    headers: withSession,
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  });

  // 3) tools/call
  const resp = await fetch(serverUrl, {
    method: "POST",
    headers: withSession,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
  });

  const text = await resp.text();
  if (!resp.ok) throw new Error(`MCP tool ${resp.status}: ${text.slice(0, 200)}`);
  return parseMcp(text);
}

/**
 * MCP araçları sonucu `content[].text` içinde JSON STRING olarak döndürüyor —
 * yani iki kat sarılı. Çözülemezse ham metni döndür ki çağıran boş kalmasın.
 */
export function unwrapMcpResult(res: any): any {
  const text = res?.result?.content?.[0]?.text ?? res?.content?.[0]?.text;
  if (typeof text !== "string") return res?.result ?? res;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
