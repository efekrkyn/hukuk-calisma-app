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
