const WORKER_URL =
  process.env.NEXT_PUBLIC_WORKER_URL ?? "http://localhost:8787";

export class WorkerError extends Error {
  constructor(public status: number, public path: string, message?: string) {
    super(`Worker ${path}: ${status} ${message ?? ""}`.trim());
    this.name = "WorkerError";
  }
}

export async function fetchWorker<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const r = await fetch(`${WORKER_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!r.ok) {
    let msg = "";
    try {
      msg = await r.text();
    } catch {}
    throw new WorkerError(r.status, path, msg);
  }
  return r.json() as Promise<T>;
}

export type HealthResponse = { status: string; ts: string; region: string };

export type SyncStatus = {
  status: string;
  counts: Record<string, number>;
  ts: string;
};

export type PdfListItem = { key: string; size: number; uploaded: string };
export type PdfListResponse = {
  objects: PdfListItem[];
  truncated: boolean;
  cursor: string | null;
};

export const api = {
  health: () => fetchWorker<HealthResponse>("/health"),
  syncStatus: () => fetchWorker<SyncStatus>("/sync/status"),
  listPdfs: (prefix = "") =>
    fetchWorker<PdfListResponse>(
      `/pdf/list${prefix ? `?prefix=${encodeURIComponent(prefix)}` : ""}`
    ),
};

export const pdfUrl = (key: string) =>
  `${WORKER_URL}/pdf/${key.split("/").map(encodeURIComponent).join("/")}`;

// ===== AI Chat (SSE stream) =====

export type ChatSource = {
  pdf: string;
  page_start: number;
  page_end: number;
  score: number;
};

export type ChatEvent =
  | { type: "sources"; data: ChatSource[] }
  | { type: "token"; data: string }
  | { type: "done" }
  | { type: "error"; data: string };

export async function* streamChat(params: {
  question: string;
  selected_text?: string;
  course?: string;
  pdf_key?: string;
  top_k?: number;
}): AsyncGenerator<ChatEvent> {
  const r = await fetch(`${WORKER_URL}/ai/chat`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!r.ok || !r.body) {
    const text = await r.text().catch(() => "");
    throw new Error(`AI chat ${r.status}: ${text.slice(0, 200)}`);
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
      const lines = ev.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event: "))?.slice(7);
      const dataLine = lines.find((l) => l.startsWith("data: "))?.slice(6);
      if (!eventLine || !dataLine) continue;
      try {
        if (eventLine === "sources") {
          yield { type: "sources", data: JSON.parse(dataLine) as ChatSource[] };
        } else if (eventLine === "token") {
          yield { type: "token", data: JSON.parse(dataLine) as string };
        } else if (eventLine === "done") {
          yield { type: "done" };
        } else if (eventLine === "error") {
          yield { type: "error", data: JSON.parse(dataLine) as string };
        }
      } catch {
        // partial/malformed event
      }
    }
  }
}
