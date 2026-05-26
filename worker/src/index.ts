import { Hono } from "hono";
import { cors } from "hono/cors";
import { verify } from "hono/jwt";
import { health } from "./routes/health";
import { sync } from "./routes/sync";
import { pdf } from "./routes/pdf";
import { admin } from "./routes/admin";
import { ai } from "./routes/ai";
import { authRouter } from "./routes/auth";
import { flashcardsRouter } from "./routes/flashcards";
import { quizRouter } from "./routes/quiz";

type Bindings = {
  DB?: D1Database;
  PDF_BUCKET: R2Bucket;
  VECTORIZE: VectorizeIndex;
  AI: Ai;
  ADMIN_SECRET: string;
  GEMINI_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS: origin'i echo ediyoruz çünkü credentials:true ile wildcard yasak.
// Tüm vercel.app / localhost / custom domain'leri kabul eder.
app.use(
  "*",
  cors({
    origin: (origin) => origin || "",
    credentials: true,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Global Authentication Middleware
app.use("*", async (c, next) => {
  const path = c.req.path;
  
  // CORS Preflight, health, login, mevzuat ve root isteklerini bypass et
  if (
    c.req.method === "OPTIONS" ||
    path === "/" ||
    path === "/health" ||
    path === "/auth/login" ||
    path.startsWith("/mevzuat")
  ) {
    return await next();
  }

  const authHeader = c.req.header("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
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

import { mevzuat } from "./routes/mevzuat";

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

export default app;
