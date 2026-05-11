import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword, isPasswordStrong } from "@/lib/auth/password";
import { audit } from "@/lib/auth/audit";
import { getClientIp, getUserAgent } from "@/lib/auth/request";

const schema = z.object({
  current: z.string().min(1),
  next: z.string().min(12).max(200),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }

  const strong = isPasswordStrong(body.next);
  if (!strong.ok)
    return NextResponse.json({ error: strong.reason }, { status: 400 });

  const user = await db.user.findUnique({
    where: { id: session.uid },
    select: { password: true, workspaceId: true },
  });
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ok = await verifyPassword(body.current, user.password);
  if (!ok)
    return NextResponse.json({ error: "Senha atual incorreta" }, { status: 401 });

  await db.user.update({
    where: { id: session.uid },
    data: { password: await hashPassword(body.next) },
  });

  await audit({
    workspaceId: user.workspaceId,
    userId: session.uid,
    action: "auth.password_changed",
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
  });

  return NextResponse.json({ ok: true });
}
