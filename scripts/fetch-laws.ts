/**
 * HMGS kapsamındaki eksik kanunları mevzuat.gov.tr'den çekip index'e alır.
 *
 * Korpus AÜHF final dersleri için toplanmıştı; HMGS'nin bazı alanlarının
 * kanunu hiç yoktu (AYM 6216, GVK 193, KDV 3065, AATUHK 6183, FSEK 5846,
 * DMK 657 …). Denetimde bu yüzden "kaynakta yok" damgaları çıkıyordu.
 *
 *   npx tsx fetch-laws.ts            # hepsi
 *   npx tsx fetch-laws.ts 6216 193   # sadece bu numaralar
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const MCP = "https://mevzuat.surucu.dev/mcp";
const WORKER = process.env.WORKER_URL ?? "https://hukuk-worker.efearas06.workers.dev";
const ADMIN_SECRET = process.env.ADMIN_SECRET!;
const OUT_DIR = process.env.LAW_OUT ?? "/Users/efekarakoyun/hukukçalışma/resources/mevzuat";

const CHUNK_CHARS = 2000;
const CHUNK_OVERLAP = 400;
const BATCH = 32;

/** HMGS alanlarında geçen ama korpusta olmayan kanunlar. */
const WANTED: Array<{ no: string; slug: string; search: string }> = [
  { no: "6216", slug: "anayasa-mahkemesi", search: "anayasa mahkemesinin kuruluşu" },
  { no: "657",  slug: "devlet-memurlari", search: "devlet memurları kanunu" },
  { no: "2942", slug: "kamulastirma",     search: "kamulaştırma kanunu" },
  { no: "3194", slug: "imar",             search: "imar kanunu" },
  { no: "193",  slug: "gelir-vergisi",    search: "gelir vergisi kanunu" },
  { no: "3065", slug: "katma-deger-vergisi", search: "katma değer vergisi kanunu" },
  { no: "6183", slug: "amme-alacaklari",  search: "amme alacaklarının tahsil usulü" },
  { no: "5846", slug: "fsek",             search: "fikir ve sanat eserleri kanunu" },
];

// ---------- MCP ----------
let sessionId = "";
async function mcp(body: unknown) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;
  const r = await fetch(MCP, { method: "POST", headers, body: JSON.stringify(body) });
  const sid = r.headers.get("mcp-session-id");
  if (sid) sessionId = sid;
  const text = await r.text();
  for (const line of text.split("\n")) {
    if (line.trimStart().startsWith("data:")) {
      return JSON.parse(line.trimStart().slice(5).trim());
    }
  }
  return text ? JSON.parse(text) : null;
}

async function initMcp() {
  await mcp({
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: {
      protocolVersion: "2024-11-05", capabilities: {},
      clientInfo: { name: "fetch-laws", version: "1.0" },
    },
  });
  await mcp({ jsonrpc: "2.0", method: "notifications/initialized" });
}

async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  const res = await mcp({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } });
  return res?.result?.content?.[0]?.text ?? "";
}

// ---------- chunk ----------
function shortHash(s: string, n: number) {
  return createHash("sha256").update(s).digest("hex").slice(0, n);
}

function chunkText(text: string) {
  const out: Array<{ text: string; idx: number }> = [];
  let i = 0, idx = 0;
  while (i < text.length) {
    out.push({ text: text.slice(i, i + CHUNK_CHARS), idx: idx++ });
    i += CHUNK_CHARS - CHUNK_OVERLAP;
  }
  return out;
}

async function ingest(chunks: unknown[]) {
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH);
    let attempt = 0;
    while (true) {
      attempt++;
      const r = await fetch(`${WORKER}/admin/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ADMIN_SECRET}` },
        body: JSON.stringify({ chunks: slice }),
      });
      if (r.ok) { process.stdout.write("."); break; }
      if (attempt >= 5) throw new Error(`/admin/embed ${r.status}: ${(await r.text()).slice(0, 200)}`);
      await new Promise((s) => setTimeout(s, 2000 * 2 ** (attempt - 1)));
    }
  }
}

async function main() {
  if (!ADMIN_SECRET) throw new Error("ADMIN_SECRET yok (scripts/.env)");
  mkdirSync(OUT_DIR, { recursive: true });
  await initMcp();

  const only = process.argv.slice(2);
  const list = only.length ? WANTED.filter((w) => only.includes(w.no)) : WANTED;

  for (const law of list) {
    process.stdout.write(`\n▶ ${law.no} ${law.slug} … `);

    const found = await callTool("search_mevzuat", {
      mevzuat_adi: law.search, mevzuat_tur: "KANUN", page_size: 20,
    });
    // "- [6216] BAŞLIK (Kanunlar) | mevzuatId: 103093"
    const re = new RegExp(`^-\\s*\\[${law.no}\\].*?mevzuatId:\\s*(\\d+)`, "m");
    const m = re.exec(found);
    if (!m) {
      console.log(`BULUNAMADI (arama: "${law.search}")`);
      continue;
    }

    const content = await callTool("get_mevzuat_content", { mevzuat_id: m[1] });
    if (!content || content.length < 1000) {
      console.log(`METIN KISA (${content.length})`);
      continue;
    }

    // Yerel kopya — kaynak denetlenebilsin
    const file = join(OUT_DIR, `${law.slug}-${law.no}.md`);
    writeFileSync(file, content);

    const key = `dersler/kanunlar/${law.slug}-${law.no}.md`;
    const hash = shortHash(key, 12);
    const chunks = chunkText(content).map((c) => ({
      id: `kanunlar_${hash}_${c.idx.toString().padStart(4, "0")}`,
      course: "kanunlar",
      pdf: key,
      page_start: 1,
      page_end: 1,
      text: c.text,
    }));

    process.stdout.write(`${content.length} kr → ${chunks.length} chunk `);
    await ingest(chunks);
    console.log(" ok");
  }
  console.log("\nbitti");
}

main();
