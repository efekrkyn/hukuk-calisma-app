/**
 * Canlı mevzuat araması — mevzuat.gov.tr üzerinden (MevzuatGovTrMCP).
 *
 * Korpustaki 23 statik kanun PDF'i sınırlıydı ve güncelliği garanti değil;
 * bu uç mevzuatın tamamına erişiyor. Korpusta hiç olmayan kanunlar (ör.
 * Gelir Vergisi Kanunu 193) buradan geliyor.
 *
 * Not: arama ANAHTAR KELİMEYLE yapılıyor, kanun numarasıyla değil —
 * "3065" değil "katma değer vergisi".
 */
import { Hono } from "hono";
import { callMcpTool, unwrapMcpResult } from "../lib/mcp-client";

const MEVZUAT_MCP_URL = "https://mevzuat.surucu.dev/mcp";

export const mevzuat = new Hono();

/**
 * Sonuç satırı düz metin geliyor:
 *   - [7420] GELİR VERGİSİ KANUNU ... (Kanunlar) | mevzuatId: 103175 | RG: 2022-11-09
 * Frontend'in işleyebilmesi için yapılandır.
 */
const LINE = /^-\s*\[([^\]]+)\]\s*(.+?)\s*\(([^)]*)\)\s*\|\s*mevzuatId:\s*(\d+)(?:.*?RG:\s*([\d-]+))?/;

export function parseMevzuatLines(text: string) {
  const items: Array<{
    mevzuat_no: string;
    title: string;
    tur: string;
    mevzuat_id: string;
    rg_tarihi: string | null;
  }> = [];
  for (const line of text.split("\n")) {
    const m = LINE.exec(line.trim());
    if (!m) continue;
    items.push({
      mevzuat_no: m[1],
      title: m[2].trim(),
      tur: m[3].trim(),
      mevzuat_id: m[4],
      rg_tarihi: m[5] ?? null,
    });
  }
  return items;
}

/**
 * Kanun adıyla ara.
 *
 * `search_kanun` (mevzuat.gov.tr) aranacak_ifade'yi yok sayıp en yeni
 * kanunları listeliyordu — "gelir vergisi" araması İklim Kanunu döndürüyordu.
 * bedesten.adalet.gov.tr kaynağı doğru filtreliyor; page_size 20'yi aşamıyor.
 */
mevzuat.post("/search", async (c) => {
  let body: { query?: string; page?: number; tur?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const query = (body.query ?? "").trim();
  if (!query) return c.json({ error: "query gerekli" }, 400);

  try {
    const res = await callMcpTool(MEVZUAT_MCP_URL, "search_mevzuat", {
      mevzuat_adi: query,
      mevzuat_tur: body.tur ?? "KANUN",
      page_size: 20,
      ...(body.page ? { page: body.page } : {}),
    });
    const out = unwrapMcpResult(res);
    const text = typeof out?.raw === "string" ? out.raw : "";
    return c.json({ ok: true, results: parseMevzuatLines(text), raw: text.slice(0, 200) });
  } catch (e) {
    console.error("mevzuat search:", e);
    return c.json({ error: "Mevzuat araması başarısız", detail: String(e).slice(0, 200) }, 502);
  }
});

/** Belirli bir kanunun maddeleri içinde ara. */
mevzuat.post("/within", async (c) => {
  let body: { mevzuat_no?: string | number; keyword?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const no = String(body.mevzuat_no ?? "").trim();
  const keyword = (body.keyword ?? "").trim();
  if (!no || !keyword) return c.json({ error: "mevzuat_no ve keyword gerekli" }, 400);

  try {
    const res = await callMcpTool(MEVZUAT_MCP_URL, "search_within_kanun", {
      mevzuat_no: no,
      keyword,
    });
    return c.json({ ok: true, result: unwrapMcpResult(res) });
  } catch (e) {
    console.error("mevzuat within:", e);
    return c.json({ error: "Madde araması başarısız", detail: String(e).slice(0, 200) }, 502);
  }
});
