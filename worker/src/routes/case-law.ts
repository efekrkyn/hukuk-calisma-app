import { Hono } from "hono";

type Bindings = Record<string, never>;

export const caseLaw = new Hono<{ Bindings: Bindings }>();

const YARGI_MCP_URL = "https://yargimcp.surucu.dev/mcp";

/** MCP yanıtı SSE ("data: {...}") veya düz JSON dönebilir; ikisini de parse et. */
function parseMcp(text: string): any {
  if (text.includes("data:")) {
    const dataLine = text.split("\n").find((l) => l.trimStart().startsWith("data:"));
    if (!dataLine) throw new Error("SSE içinde data satırı yok");
    return JSON.parse(dataLine.trimStart().slice(5).trim());
  }
  return JSON.parse(text);
}

async function callMcp(rpcBody: unknown): Promise<any> {
  // 1) Initialize Handshake
  const initResp = await fetch(YARGI_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
    },
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
    throw new Error(`MCP Init ${initResp.status}: ${(await initResp.text()).slice(0, 200)}`);
  }
  
  const sessionId = initResp.headers.get("mcp-session-id");
  if (!sessionId) {
    throw new Error("MCP Handshake failed: No mcp-session-id header");
  }

  // 2) Initialized Notification
  await fetch(YARGI_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      "Mcp-Session-Id": sessionId,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
  });

  // 3) Actual Tool Call
  const resp = await fetch(YARGI_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      "Mcp-Session-Id": sessionId,
    },
    body: JSON.stringify(rpcBody),
  });
  
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`MCP Tool ${resp.status}: ${text.slice(0, 200)}`);
  }
  return parseMcp(text);
}

caseLaw.post("/search", async (c) => {
  let body: { court?: string; query?: string; date_from?: string; page?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }
  if (!body.query) return c.json({ error: "query required" }, 400);

  const court = body.court || "yargitay";
  let mappedCourt = "YARGITAYKARARI";
  if (court.toLowerCase() === "danistay") mappedCourt = "DANISTAYKARAR";
  else if (court.toLowerCase() === "yerel") mappedCourt = "YERELHUKUK";
  else if (court.toLowerCase() === "istinaf") mappedCourt = "ISTINAFHUKUK";
  else if (court.toLowerCase() === "kyb") mappedCourt = "KYB";

  const rpcBody = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "search_bedesten_unified",
      arguments: {
        phrase: body.query,
        court_types: [mappedCourt],
        ...(body.date_from && { date_from: body.date_from }),
      },
    },
  };

  try {
    const parsed = await callMcp(rpcBody);
    if (parsed.error) {
      return c.json({ error: `MCP error: ${JSON.stringify(parsed.error).slice(0, 200)}` }, 502);
    }
    let finalResults = [];
    const content = parsed.result?.content || [];
    if (content.length > 0 && content[0].text) {
      try {
        const textData = JSON.parse(content[0].text);
        if (textData.decisions) {
          finalResults = textData.decisions.map((d: any) => ({
            document_id: d.documentId,
            case_no: (d.esasNo ? d.esasNo + " E. " : "") + (d.kararNo ? d.kararNo + " K." : ""),
            date: d.kararTarihiStr,
            summary: d.birimAdi,
            court: "Yargıtay"
          }));
        }
      } catch (err) {
        console.error("Failed to parse MCP JSON:", err);
      }
    }
    return c.json({ results: finalResults });
  } catch (e) {
    return c.json({ error: `Yargı MCP error: ${String(e).slice(0, 200)}` }, 502);
  }
});

caseLaw.post("/document", async (c) => {
  let body: { document_id?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }
  if (!body.document_id) return c.json({ error: "document_id required" }, 400);

  const rpcBody = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "get_bedesten_document_markdown",
      arguments: { document_id: body.document_id },
    },
  };

  try {
    const parsed = await callMcp(rpcBody);
    if (parsed.error) {
      return c.json({ error: `MCP error: ${JSON.stringify(parsed.error).slice(0, 200)}` }, 502);
    }
    return c.json({ document: parsed.result?.content || null });
  } catch (e) {
    return c.json({ error: String(e).slice(0, 200) }, 502);
  }
});
