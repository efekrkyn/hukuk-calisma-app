import { Hono } from "hono";
import { cors } from "hono/cors";
import { verify } from "hono/jwt";
import { getCookie } from "hono/cookie";
import { health } from "./routes/health";
import { sync } from "./routes/sync";
import { pdf } from "./routes/pdf";
import { admin } from "./routes/admin";
import { ai } from "./routes/ai";
import { authRouter, resolveUserId } from "./routes/auth";
import { flashcardsRouter } from "./routes/flashcards";
import { quizRouter } from "./routes/quiz";
import { plan } from "./routes/plan";
import { hmgs } from "./routes/hmgs";
import { mevzuat } from "./routes/mevzuat";
import { caseLaw } from "./routes/case-law";

type Bindings = {
  DB: D1Database;
  PDF_BUCKET: R2Bucket;
  VECTORIZE: VectorizeIndex;
  AI: Ai;
  ADMIN_SECRET: string;
  GEMINI_KEY: string;
  DEEPSEEK_API_KEY?: string;
};

/**
 * Kimliği doğrulanmış isteğin sahibi.
 *
 * Uçlar kullanıcı kimliğini gövdeden ya da sorgu dizesinden ALMAZ — istemciden
 * gelen bir user_id, "başkasının verisini oku" isteğiyle aynı şey olurdu.
 * Tek kaynak imzalı token; middleware onu çözüp buraya koyuyor.
 */
type Variables = {
  userId: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

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
  //
  // /auth/register BİLEREK bu listede DEĞİL: yeni hesap açmak geçerli bir
  // oturum gerektiriyor. Açık kayıt, herkesin uygulama sahibinin faturasıyla
  // soru ürettirmesi demek olurdu (/hmgs/generate, /ai/* para harcıyor).
  // Sahibi ADMIN_SECRET ile /auth/login'den token alıp buradan geçiyor.
  if (
    c.req.method === "OPTIONS" ||
    path === "/" ||
    path === "/health" ||
    path === "/auth/login" ||
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
    const payload = await verify(token, c.env.ADMIN_SECRET, "HS256");
    // Kullanıcı kimliği burada, doğrulamanın hemen ardından iliştiriliyor.
    // Uçlar `c.get("userId")` ile okuyor; hiçbiri tokenı yeniden çözmüyor.
    c.set("userId", resolveUserId(payload.sub));
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
app.route("/case-law", caseLaw);
app.route("/flashcards", flashcardsRouter);
app.route("/quiz", quizRouter);
app.route("/plan", plan);
app.route("/hmgs", hmgs);
app.route("/mevzuat", mevzuat);

export default app;
