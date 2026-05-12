import { NextResponse } from "next/server";
import { destroySession, getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth/audit";
import { getClientIp, getUserAgent } from "@/lib/auth/request";

/**
 * POST /api/auth/logout
 *
 * Comportamento:
 * - Se chamado por XHR (fetch com Accept: application/json) -> JSON { ok: true }
 * - Se chamado por form HTML (browser navega na URL) -> redireciona para /login
 */
async function handle(req: Request) {
  const session = await getSession();
  if (session) {
    await db.user
      .update({ where: { id: session.uid }, data: { isOnline: false } })
      .catch(() => null);
    await audit({
      workspaceId: session.wid,
      userId: session.uid,
      action: "auth.logout",
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }
  await destroySession();

  // Browser navega na URL (form action) -> Accept: text/html -> redirect
  const accept = req.headers.get("accept") ?? "";
  const wantsJson = accept.includes("application/json");
  if (!wantsJson) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url, { status: 303 });
  }
  return NextResponse.json({ ok: true });
}

export const POST = handle;
export const GET = handle; // permite logout via link tambem
