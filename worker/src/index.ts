import { Hono } from "hono";
import { cors } from "hono/cors";
import { health } from "./routes/health";
import { sync } from "./routes/sync";
import { pdf } from "./routes/pdf";

type Bindings = {
  DB?: D1Database;          // Sprint 0 sonunda aktive (wrangler login + d1 create sonrası)
  PDF_BUCKET: R2Bucket;
  // AUTH_SECRET: string;     // Task 10
  // APP_PASSWORD: string;    // Task 10
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors({ origin: "*", credentials: true }));

app.get("/", (c) => c.text("Hukuk Worker"));
app.route("/health", health);
app.route("/sync", sync);
app.route("/pdf", pdf);

export default app;
