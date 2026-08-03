import { Hono } from "hono";
import { callMcpTool } from "../lib/mcp-client";

type Bindings = Record<string, never>;

export const caseLaw = new Hono<{ Bindings: Bindings }>();

const YARGI_MCP_URL = "https://yargimcp.surucu.dev/mcp";

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

  const TOOL = "search_bedesten_unified";
  const TOOL_ARGS = {
    phrase: body.query,
    court_types: [mappedCourt],
    ...(body.date_from && { date_from: body.date_from }),
  };

  try {
    const parsed = await callMcpTool(YARGI_MCP_URL, TOOL, TOOL_ARGS);
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

  try {
    const parsed = await callMcpTool(
      YARGI_MCP_URL,
      "get_bedesten_document_markdown",
      { document_id: body.document_id }
    );
    if (parsed.error) {
      return c.json({ error: `MCP error: ${JSON.stringify(parsed.error).slice(0, 200)}` }, 502);
    }
    return c.json({ document: parsed.result?.content || null });
  } catch (e) {
    return c.json({ error: String(e).slice(0, 200) }, 502);
  }
});
