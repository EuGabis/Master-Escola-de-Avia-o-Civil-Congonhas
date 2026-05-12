import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { checkRateLimit, resetRateLimit } from "@/lib/auth/rate-limit";
import { isLocked, recordFailure, clearLockout } from "@/lib/auth/lockout";
import { audit } from "@/lib/auth/audit";
import { getClientIp, getUserAgent } from "@/lib/auth/request";

const bodySchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1).max(200),
});

async function constantDelay() {
  await new Promise((r) => setTimeout(r, 250));
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const ua = getUserAgent(req);

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }

  // 1) Account lockout (10 falhas em 1h)
  const lock = await isLocked(body.email);
  if (lock.locked) {
    const minutes = Math.ceil(lock.remainingSeconds / 60);
    return NextResponse.json(
      {
        error: `Conta bloqueada por seguranca. Tente novamente em ${minutes} minuto(s) ou recupere a senha.`,
      },
      { status: 423, headers: { "Retry-After": String(lock.remainingSeconds) } }
    );
  }

  // 2) Rate limit por IP (anti brute-force distribuido)
  const ipLimit = await checkRateLimit(`login:ip:${ip}`, 20, 15 * 60);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente em alguns minutos." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter ?? 60) } }
    );
  }

  // 3) Rate limit por email (anti credential stuffing)
  const emailLimit = await checkRateLimit(`login:email:${body.email}`, 5, 15 * 60);
  if (!emailLimit.ok) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente em alguns minutos." },
      { status: 429, headers: { "Retry-After": String(emailLimit.retryAfter ?? 60) } }
    );
  }

  // 4) Busca usuario
  const user = await db.user.findUnique({
    where: { email: body.email },
    include: { workspace: { select: { id: true, active: true } } },
  });

  // 5) Verifica senha (bcrypt sempre roda - anti enumeration)
  const fakeHash = "$2b$12$fakehashfakehashfakehashfakehashfakehashfakehashfakehashfaa";
  const valid = await verifyPassword(body.password, user?.password ?? fakeHash);

  if (!user || !valid || !user.workspace.active) {
    await constantDelay();
    const fail = await recordFailure(body.email);
    if (user) {
      await audit({
        workspaceId: user.workspaceId,
        userId: user.id,
        action: "auth.login_failed",
        ip,
        userAgent: ua,
        meta: {
          reason: !valid ? "wrong_password" : "workspace_inactive",
          consecutiveFailures: fail.attempts,
          locked: fail.locked,
        },
      });
    }
    return NextResponse.json({ error: "Credenciais invalidas" }, { status: 401 });
  }

  // 6) Sucesso: limpa contadores
  await createSession({
    uid: user.id,
    wid: user.workspaceId,
    role: user.role,
    email: user.email,
  });
  await Promise.all([
    resetRateLimit(`login:email:${body.email}`),
    clearLockout(body.email),
  ]);

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
