import { Hono } from "hono";
import { sign } from "hono/jwt";

type Bindings = {
  ADMIN_SECRET: string;
};

export const authRouter = new Hono<{ Bindings: Bindings }>();

authRouter.post("/login", async (c) => {
  let body: { password?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  if (!body.password) {
    return c.json({ error: "Şifre girilmesi zorunludur." }, 400);
  }

  if (body.password !== c.env.ADMIN_SECRET) {
    return c.json({ error: "Hatalı şifre." }, 401);
  }

  // Generate JWT token
  const token = await sign(
    {
      sub: "efe",
      // 1 yıl. Şifre kalkmıyor çünkü aynı API'nin arkasında para harcayan
      // uçlar var (/hmgs/generate, /hmgs/verify, /ai/*) ve workers.dev
      // adresleri taranabiliyor. Ama sınava hazırlanan kişinin ayda bir
      // tekrar giriş yapmasının da bir güvenlik faydası yok — tek cihazda
      // yıllık oturum, sürtünmeyi sıfırlarken korumayı aynı bırakıyor.
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    },
    c.env.ADMIN_SECRET
  );

  return c.json({ success: true, token });
});
