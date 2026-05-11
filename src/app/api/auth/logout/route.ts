import { NextResponse } from "next/server";
import { destroySession, getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth/audit";
import { getClientIp, getUserAgent } from "@/lib/auth/request";

export async function POST(req: Request) {
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
  return NextResponse.json({ ok: true });
}
