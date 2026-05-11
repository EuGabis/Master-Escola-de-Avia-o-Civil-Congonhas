import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth/audit";
import { getClientIp, getUserAgent } from "@/lib/auth/request";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.role !== "owner" && session.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem remover agentes" },
      { status: 403 }
    );
  }

  const { id } = await params;

  if (id === session.uid) {
    return NextResponse.json(
      { error: "Voce nao pode remover sua propria conta" },
      { status: 400 }
    );
  }

  const target = await db.user.findFirst({
    where: { id, workspaceId: session.wid },
    select: { id: true, role: true, email: true },
  });
  if (!target)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (target.role === "owner") {
    return NextResponse.json(
      { error: "Nao eh possivel remover o owner do workspace" },
      { status: 400 }
    );
  }

  await db.user.delete({ where: { id } });

  await audit({
    workspaceId: session.wid,
    userId: session.uid,
    action: "user.delete",
    target: id,
    meta: { email: target.email },
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
  });

  return NextResponse.json({ ok: true });
}
