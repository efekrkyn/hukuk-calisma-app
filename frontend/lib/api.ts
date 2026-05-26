const WORKER_URL =
  typeof window !== "undefined"
    ? "/api/worker"
    : (process.env.NEXT_PUBLIC_WORKER_URL ?? "http://localhost:8787");

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
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const r = await fetch(`${WORKER_URL}${path}`, {
    credentials: "include",
    ...init,
    headers,
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
  getMevzuat: () => fetchWorker<{ items: Array<{ title: string; link: string; pubDate: string; description: string }> }>("/mevzuat/rss"),
  uploadPdf: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    
    const r = await fetch(`${WORKER_URL}/pdf/upload`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    if (!r.ok) {
      throw new Error(`Upload failed: ${r.status}`);
    }
    return r.json() as Promise<{ success: boolean; key: string; size: number }>;
  }
};

export const pdfUrl = (key: string) =>
  `/api/worker/pdf/${key.split("/").map(encodeURIComponent).join("/")}`;

// ===== Practice Grading =====

export type GradeResponse = {
  score: number;
  feedback: string;
  hit_points: string[];
  missed_points: string[];
  errors: string[];
  ideal_solution: string;
  /** Grading sırasında AI'a context olarak verilen kanun chunk referansları. */
  law_refs?: Array<{ pdf: string; page_start: number; page_end: number }>;
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
  /** Worker tarafında kullanılan AI prompt modu. "law" → kanun açıklama. */
  mode?: "default" | "law";
  history?: Array<{ role: "user" | "model" | "assistant" | "ai"; content: string }>;
}): AsyncGenerator<ChatEvent> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const r = await fetch(`${WORKER_URL}/ai/chat`, {
    method: "POST",
    credentials: "include",
    headers,
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

export async function* streamDilekce(params: {
  documentType: string;
  details: string;
}): AsyncGenerator<ChatEvent> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const r = await fetch(`${WORKER_URL}/ai/dilekce`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(params),
  });
  if (!r.ok || !r.body) {
    const text = await r.text().catch(() => "");
    throw new Error(`AI dilekce ${r.status}: ${text.slice(0, 200)}`);
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
          if (currentEvent === "token") {
            yield { type: "token", data: JSON.parse(payload) as string };
          } else if (currentEvent === "done") {
            yield { type: "done" };
          } else if (currentEvent === "error") {
            yield { type: "error", data: JSON.parse(payload) as string };
          }
        } catch {}
        continue;
      }
    }
  }
}

// ===== Flashcards (SRS) =====

export type FlashcardState = {
  card_id: string;
  course: string;
  ease: number;
  interval_days: number;
  next_review: number;
  last_seen: number | null;
  streak: number;
};

export async function getFlashcardState(courseId: string): Promise<{ state: FlashcardState[] }> {
  return fetchWorker<{ state: FlashcardState[] }>(`/flashcards/state?course=${encodeURIComponent(courseId)}`);
}

export async function submitFlashcardReview(req: {
  card_id: string;
  course: string;
  grade: number; // 0: Again, 1: Hard, 2: Good
}): Promise<{ success: boolean; newState: FlashcardState }> {
  return fetchWorker<{ success: boolean; newState: FlashcardState }>("/flashcards/review", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// ===== Quiz Engine =====

export type QuizStats = {
  total_attempts: number;
  correct_count: number;
  weakTopics: string[];
};

export async function getQuizStats(courseId: string): Promise<QuizStats> {
  return fetchWorker<QuizStats>(`/quiz/stats?course=${encodeURIComponent(courseId)}`);
}

export async function submitQuizAttempt(req: {
  course: string;
  topic: string;
  question_id: string;
  selected_answer: number;
  is_correct: number;
}): Promise<{ success: boolean; id: string }> {
  return fetchWorker<{ success: boolean; id: string }>("/quiz/submit", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export type DynamicQuizQuestion = {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
};

export async function generateDynamicQuiz(req: {
  course: string;
  topic: string;
  count: number;
  difficulty: string;
}): Promise<DynamicQuizQuestion[]> {
  return fetchWorker<DynamicQuizQuestion[]>("/ai/generate-quiz", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

