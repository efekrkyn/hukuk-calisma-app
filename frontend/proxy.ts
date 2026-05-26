import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Static assets, favicon, manifest, sw.js ve login sayfasını bypass et
  if (
    path.startsWith("/_next") ||
    path.startsWith("/static") ||
    path.startsWith("/public") ||
    path === "/login" ||
    path === "/manifest.json" ||
    path === "/sw.js" ||
    path === "/favicon.ico" ||
    path.endsWith(".png") ||
    path.endsWith(".ico")
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get("hukuk_session")?.value;

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.ADMIN_SECRET);
    await jwtVerify(session, secret);
    return NextResponse.next();
  } catch (e) {
    // JWT geçersiz veya süresi dolmuşsa login'e yönlendir ve cookie'yi sil
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("hukuk_session");
    return response;
  }
}
