import { Hono } from "hono";
import { cors } from "hono/cors";
import { health } from "./routes/health";
import { sync } from "./routes/sync";
import { pdf } from "./routes/pdf";
import { admin } from "./routes/admin";
import { ai } from "./routes/ai";

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

app.get("/", (c) => c.text("Hukuk Worker"));
app.route("/health", health);
app.route("/sync", sync);
app.route("/pdf", pdf);
app.route("/admin", admin);
app.route("/ai", ai);

export default app;
