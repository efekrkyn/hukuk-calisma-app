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

// ===== Practice Grading =====

export type GradeResponse = {
  score: number;
  feedback: string;
  hit_points: string[];
  missed_points: string[];
  errors: string[];
  ideal_solution: string;
};

export async function gradePractice(req: {
  case_id: string;
  scenario: string;
  ideal_solution: string;
  key_points: string[];
  user_solution: string;
}): Promise<GradeResponse> {
  return fetchWorker<GradeResponse>("/ai/practice-grade", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

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
  let currentEvent: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n");

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line === "") {
        // boş satır = event dispatch boundary (zaten yield ediyoruz)
        currentEvent = null;
        continue;
      }
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
        continue;
      }
      if (line.startsWith("data: ")) {
        const payload = line.slice(6);
        try {
          if (currentEvent === "sources") {
            yield { type: "sources", data: JSON.parse(payload) as ChatSource[] };
          } else if (currentEvent === "token") {
            yield { type: "token", data: JSON.parse(payload) as string };
          } else if (currentEvent === "done") {
            yield { type: "done" };
          } else if (currentEvent === "error") {
            yield { type: "error", data: JSON.parse(payload) as string };
          }
        } catch {
          // partial/malformed event
        }
        continue;
      }
    }
  }
}
