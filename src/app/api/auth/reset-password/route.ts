import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, isPasswordStrong } from "@/lib/auth/password";
import { audit } from "@/lib/auth/audit";
import { getClientIp, getUserAgent } from "@/lib/auth/request";

const bodySchema = z.object({
  token: z.string().min(32).max(128),
  password: z.string().min(12).max(200),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const ua = getUserAgent(req);

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }

  const strong = isPasswordStrong(body.password);
  if (!strong.ok) {
    return NextResponse.json({ error: strong.reason }, { status: 400 });
  }

  const reset = await db.passwordReset.findUnique({
    where: { token: body.token },
  });

  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Token invalido ou expirado" },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({
    where: { email: reset.email },
    select: { id: true, workspaceId: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Token invalido" }, { status: 400 });
  }

  const newHash = await hashPassword(body.password);

  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { password: newHash } }),
    db.passwordReset.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await audit({
    workspaceId: user.workspaceId,
    userId: user.id,
    action: "auth.password_reset_completed",
    ip,
    userAgent: ua,
  });

  return NextResponse.json({ ok: true });
}
