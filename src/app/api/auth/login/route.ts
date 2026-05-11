import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { checkRateLimit, resetRateLimit } from "@/lib/auth/rate-limit";
import { audit } from "@/lib/auth/audit";
import { getClientIp, getUserAgent } from "@/lib/auth/request";

const bodySchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1).max(200),
});

// Pequeno delay constante pra evitar timing attacks
async function constantDelay() {
  await new Promise((r) => setTimeout(r, 250));
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const ua = getUserAgent(req);

  // 1) Parse + validacao
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }

  // 2) Rate limit por IP (defesa contra brute force distribuido por emails)
  const ipLimit = await checkRateLimit(`login:ip:${ip}`, 20, 15 * 60);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente em alguns minutos." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter ?? 60) } }
    );
  }

  // 3) Rate limit por email (defesa contra credential stuffing num usuario especifico)
  const emailLimit = await checkRateLimit(`login:email:${body.email}`, 5, 15 * 60);
  if (!emailLimit.ok) {
    return NextResponse.json(
      { error: "Conta temporariamente bloqueada por excesso de tentativas." },
      { status: 429, headers: { "Retry-After": String(emailLimit.retryAfter ?? 60) } }
    );
  }

  // 4) Busca usuario
  const user = await db.user.findUnique({
    where: { email: body.email },
    include: { workspace: { select: { id: true, active: true } } },
  });

  // 5) Verifica senha (sempre roda bcrypt, mesmo se usuario nao existe — anti enumeration)
  const fakeHash = "$2b$12$fakehashfakehashfakehashfakehashfakehashfakehashfakehashfaa";
  const valid = await verifyPassword(
    body.password,
    user?.password ?? fakeHash
  );

  if (!user || !valid || !user.workspace.active) {
    await constantDelay();
    if (user) {
      await audit({
        workspaceId: user.workspaceId,
        userId: user.id,
        action: "auth.login_failed",
        ip,
        userAgent: ua,
        meta: { reason: !valid ? "wrong_password" : "workspace_inactive" },
      });
    }
    return NextResponse.json({ error: "Credenciais invalidas" }, { status: 401 });
  }

  // 6) Sucesso: cria sessao + reseta rate limit do email
  await createSession({
    uid: user.id,
    wid: user.workspaceId,
    role: user.role,
    email: user.email,
  });
  await resetRateLimit(`login:email:${body.email}`);

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), isOnline: true },
  });

  await audit({
    workspaceId: user.workspaceId,
    userId: user.id,
    action: "auth.login",
    ip,
    userAgent: ua,
  });

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}
