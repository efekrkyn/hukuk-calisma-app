import { Hono } from "hono";
import { cors } from "hono/cors";
import { health } from "./routes/health";

type Bindings = {
  // DB: D1Database;          // Task 6'da aktive
  // PDF_BUCKET: R2Bucket;    // Task 7'de aktive
  // AUTH_SECRET: string;     // Task 10
  // APP_PASSWORD: string;    // Task 10
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors({ origin: "*" }));

app.get("/", (c) => c.text("Hukuk Worker"));
app.route("/health", health);

export default app;
