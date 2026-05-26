import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path.startsWith("/api/worker")) {
    const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL ?? "https://hukuk-worker.efearas06.workers.dev";
    let remainingPath = path.substring("/api/worker".length);
    if (!remainingPath.startsWith("/")) {
      remainingPath = "/" + remainingPath;
    }
    const targetUrl = new URL(remainingPath + request.nextUrl.search, workerUrl);

    const requestHeaders = new Headers(request.headers);
    const session = request.cookies.get("hukuk_session")?.value;
    if (session) {
      requestHeaders.set("Authorization", `Bearer ${session}`);
    }

    return NextResponse.rewrite(targetUrl, {
      request: {
        headers: requestHeaders,
      },
    });
  }

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
