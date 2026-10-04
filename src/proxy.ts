import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/config";

/**
 * Runs before every page request:
 *  1. Generates a per-request CSP nonce (Next.js applies it to its own scripts).
 *  2. Optimistically redirects signed-out visitors to /login. This is a UX shortcut
 *     only — every page, route handler and server action re-verifies the session.
 *  3. Slides the session cookie's expiry forward.
 */

const PUBLIC_PATHS = new Set(["/login", "/signup"]);
const PUBLIC_PREFIXES = ["/api/ingest", "/api/cron/", "/api/health"];

function buildCsp(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  const appUrl = process.env.APP_URL ?? "";
  return [
    `default-src 'self'`,
    // 'wasm-unsafe-eval' allows the barcode decoder (WebAssembly) — not JS eval.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes are used by charts; styles cannot execute code.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self' data:`,
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    `media-src 'self' blob:`,
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(appUrl.startsWith("https://") ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  const isPublic = PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (!sessionToken && !isPublic) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  if (sessionToken && request.method === "GET" && !pathname.startsWith("/api/")) {
    const days = Number(process.env.SESSION_MAX_AGE_DAYS ?? 30) || 30;
    const appUrl = process.env.APP_URL;
    response.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: appUrl ? appUrl.startsWith("https://") : process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: days * 86_400,
    });
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icons/|vendor/|sw.js|offline.html|manifest.webmanifest|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
