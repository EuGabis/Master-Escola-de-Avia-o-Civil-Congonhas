import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword, isPasswordStrong } from "@/lib/auth/password";
import { destroySession } from "@/lib/auth/session";
import { audit } from "@/lib/auth/audit";
import { getClientIp, getUserAgent } from "@/lib/auth/request";
import { checkRateLimit } from "@/lib/auth/rate-limit";

const schema = z.object({
  current: z.string().min(1),
  next: z.string().min(12).max(200),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: 5 tentativas de troca por hora
  const rl = await checkRateLimit(`pwd_change:${session.uid}`, 5, 60 * 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos." },
      { status: 429 }
    );
  }

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

  // Forca re-login: destrói o cookie atual.
  // JWT eh stateless e nao da pra invalidar individualmente sem manter
  // estado em Redis - mais simples e seguro forcar novo login.
  await destroySession();

  return NextResponse.json({ ok: true, reauth: true });
}
