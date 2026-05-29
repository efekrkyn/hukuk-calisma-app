import { Hono } from "hono";
import { cors } from "hono/cors";
import { verify } from "hono/jwt";
import { getCookie } from "hono/cookie";
import { health } from "./routes/health";
import { sync } from "./routes/sync";
import { pdf } from "./routes/pdf";
import { admin } from "./routes/admin";
import { ai } from "./routes/ai";
import { authRouter } from "./routes/auth";
import { flashcardsRouter } from "./routes/flashcards";
import { quizRouter } from "./routes/quiz";
import { mevzuat } from "./routes/mevzuat";
import { plan } from "./routes/plan";

type Bindings = {
  DB: D1Database;
  PDF_BUCKET: R2Bucket;
  VECTORIZE: VectorizeIndex;
  AI: Ai;
  ADMIN_SECRET: string;
  GEMINI_KEY: string;
  DEEPSEEK_API_KEY?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS allowlist: vercel.app deployments + localhost dev + bilinen custom domain.
// Echo-any-origin desenini kaldırdık — credentials:true ile herhangi bir origin'i
// echo etmek, oturum açık kullanıcının cookie/Authorization header'ını tüm sitelere
// teslim eder. Sadece tanınan origin'lere izin ver.
const ALLOWED_ORIGIN_PATTERNS: Array<RegExp> = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/,
];

function isAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "";
  return ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin)) ? origin : "";
}

app.use(
  "*",
  cors({
    origin: (origin) => isAllowedOrigin(origin),
    credentials: true,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Global Authentication Middleware
app.use("*", async (c, next) => {
  const path = c.req.path;

  // Bypass: CORS preflight, public endpoints, ve /admin (kendi raw-secret
  // middleware'i var — script'ler JWT yerine ADMIN_SECRET ile çağırır).
  if (
    c.req.method === "OPTIONS" ||
    path === "/" ||
    path === "/health" ||
    path === "/auth/login" ||
    path.startsWith("/mevzuat") ||
    path.startsWith("/admin")
  ) {
    return await next();
  }

  const authHeader = c.req.header("Authorization") ?? "";
  let token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    token = getCookie(c, "hukuk_session") ?? "";
  }

  if (!token) {
    return c.json({ error: "Authorization required" }, 401);
  }

  try {
    await verify(token, c.env.ADMIN_SECRET, "HS256");
  } catch (e) {
    return c.json({ error: "Invalid token" }, 401);
  }

  await next();
});

app.get("/", (c) => c.text("Hukuk Worker"));
app.route("/health", health);
app.route("/auth", authRouter);
app.route("/sync", sync);
app.route("/pdf", pdf);
app.route("/admin", admin);
app.route("/ai", ai);
app.route("/flashcards", flashcardsRouter);
app.route("/quiz", quizRouter);
app.route("/mevzuat", mevzuat);
app.route("/plan", plan);

export default app;
