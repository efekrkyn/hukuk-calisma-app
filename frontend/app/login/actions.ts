"use server";

import { cookies } from "next/headers";
import { SignJWT } from "jose";

export async function loginAction(password: string) {
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    return { error: "Sunucu hatası: ADMIN_SECRET tanımlanmamış." };
  }

  if (password !== adminSecret) {
    return { error: "Hatalı şifre." };
  }

  try {
    const secret = new TextEncoder().encode(adminSecret);
    const token = await new SignJWT({ sub: "efe" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(secret);

    // Set the cookie
    const cookieStore = await cookies();
    cookieStore.set("hukuk_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return { success: true, token };
  } catch (e) {
    console.error("Login signing error:", e);
    return { error: "Token oluşturulurken bir hata oluştu." };
  }
}
