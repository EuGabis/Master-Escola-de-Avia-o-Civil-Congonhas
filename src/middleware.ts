import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "ms_session";
const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/api/auth/login",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/webhook", // Evolution API webhook (autenticado por assinatura, nao por sessao)
  "/api/health",
];

// Middleware roda em Edge Runtime — nao pode importar @prisma/client.
// Por isso a verificacao usa jose direto (que eh edge-compatible).
const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "");

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Permite assets, favicon, etc.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/fonts") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  const token = req.cookies.get(COOKIE_NAME)?.value;
  let isAuthenticated = false;

  if (token) {
    try {
      await jwtVerify(token, secret, {
        issuer: "master-crm",
        audience: "master-crm-users",
        algorithms: ["HS256"],
      });
      isAuthenticated = true;
    } catch {
      isAuthenticated = false;
    }
  }

  // Rota publica + ja logado: manda pro dashboard
  if (isPublic && isAuthenticated && pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Rota protegida + nao logado:
  if (!isPublic && !isAuthenticated) {
    // API retorna 401 JSON (XHR nao segue redirect bem)
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Paginas: redireciona pro login com ?next=
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const res = NextResponse.next();

  // Cabecalhos de seguranca aplicados em TODA resposta
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-DNS-Prefetch-Control", "off");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  );
  res.headers.set("X-XSS-Protection", "1; mode=block");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");

  if (process.env.NODE_ENV === "production") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
    // CSP - apenas em prod (dev tem hot reload com inline scripts)
    // Nao bloqueia Pusher (ws://*.pusher.com) nem APIs externas usadas
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.pusher.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "media-src 'self' data: blob:",
      "connect-src 'self' https: wss://*.pusher.com https://*.pusher.com https://*.sentry.io https://*.ingest.sentry.io",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; ");
    res.headers.set("Content-Security-Policy", csp);
  }

  return res;
}

export const config = {
  matcher: [
    // tudo exceto recursos estaticos
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
