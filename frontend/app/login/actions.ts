"use server";

import { cookies } from "next/headers";
import { SignJWT } from "jose";

/**
 * Migration 010'daki varsayılan kullanıcı. Kullanıcı adı girilmeden yapılan
 * giriş bu hesaba düşüyor; değer worker/src/routes/auth.ts ile aynı olmalı.
 */
const DEFAULT_USER_ID = "default";

/** Worker'ın oturum ömrüyle aynı (auth.ts SESSION_SECONDS): 1 yıl. */
const WORKER_SESSION_SECONDS = 60 * 60 * 24 * 365;

/** Kullanıcı adsız girişin eski ömrü — davranış aynen korunuyor. */
const LOCAL_SESSION_SECONDS = 60 * 60 * 24 * 30;

function workerUrl(): string {
  return (
    process.env.NEXT_PUBLIC_WORKER_URL ??
    "https://hukuk-worker.efearas06.workers.dev"
  );
}

async function setSessionCookie(token: string, maxAge: number) {
  const cookieStore = await cookies();
  cookieStore.set("hukuk_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

/**
 * Giriş.
 *
 * İKİ YOL:
 *
 * 1) `username` BOŞ → eski davranış birebir korunuyor: parola burada,
 *    sunucuda ADMIN_SECRET ile karşılaştırılıyor ve token yerel olarak
 *    imzalanıyor. Kaldırılamaz — dağıtılmış oturumlar ve kurulum betikleri
 *    buna bağlı. Tek değişiklik `sub`: artık varsayılan kullanıcının kimliği.
 *    (Eski tokenlardaki `sub: "efe"` worker tarafında aynı kullanıcıya
 *    eşleniyor, o yüzden açık oturumlar kırılmıyor.)
 *
 * 2) `username` DOLU → doğrulama worker'da yapılıyor: kullanıcı tablosu ve
 *    PBKDF2 karmaları orada. Frontend parolayı sadece iletiyor, kendisi
 *    doğrulamaya kalkışmıyor — parola karması iki yerde uygulanan bir kural
 *    olmamalı.
 *
 * Parola hiçbir dalda loglanmıyor ve dönen nesneye konmuyor.
 */
export async function loginAction(password: string, username?: string) {
  const user = (username ?? "").trim();

  if (user) {
    try {
      const res = await fetch(`${workerUrl()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password }),
      });
      const data = (await res.json()) as { token?: string; error?: string };

      if (!res.ok || !data.token) {
        return { error: data.error ?? "Kullanıcı adı veya şifre hatalı." };
      }

      await setSessionCookie(data.token, WORKER_SESSION_SECONDS);
      return { success: true, token: data.token };
    } catch (e) {
      // Hata metni dışarı verilmiyor: içinde worker adresi geçebilir.
      console.error("Login worker request failed");
      return { error: "Sunucuya ulaşılamadı." };
    }
  }

  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    return { error: "Sunucu hatası: ADMIN_SECRET tanımlanmamış." };
  }

  if (password !== adminSecret) {
    return { error: "Hatalı şifre." };
  }

  try {
    const secret = new TextEncoder().encode(adminSecret);
    const token = await new SignJWT({ sub: DEFAULT_USER_ID })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${LOCAL_SESSION_SECONDS}s`)
      .sign(secret);

    await setSessionCookie(token, LOCAL_SESSION_SECONDS);

    return { success: true, token };
  } catch (e) {
    console.error("Login signing error:", e);
    return { error: "Token oluşturulurken bir hata oluştu." };
  }
}
