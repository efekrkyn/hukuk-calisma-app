import { Hono } from "hono";

export const health = new Hono();

health.get("/", (c) =>
  c.json({
    status: "ok",
    ts: new Date().toISOString(),
    region: (c.req.raw as { cf?: { colo?: string } }).cf?.colo ?? "local",
  })
);
