import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { audit } from "@/lib/auth/audit";
import { getClientIp, getUserAgent } from "@/lib/auth/request";

const bodySchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const ua = getUserAgent(req);

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Email invalido" }, { status: 400 });
  }

  // Rate limit: 3 pedidos/hora por IP, 3 por email
  const ipLimit = await checkRateLimit(`forgot:ip:${ip}`, 3, 60 * 60);
  if (!ipLimit.ok) {
    return NextResponse.json({ error: "Muitas tentativas" }, { status: 429 });
  }
  await checkRateLimit(`forgot:email:${body.email}`, 3, 60 * 60);

  const user = await db.user.findUnique({
    where: { email: body.email },
    select: { id: true, workspaceId: true },
  });

  // Sempre responde 200 — nao revelar se email existe ou nao (anti enumeration)
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    await db.passwordReset.create({
      data: {
        email: body.email,
        token,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });

    await audit({
      workspaceId: user.workspaceId,
      userId: user.id,
      action: "auth.password_reset_requested",
      ip,
      userAgent: ua,
    });

    // TODO: enviar email com link /reset-password?token=...
    // Por enquanto, em dev logamos no console
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[DEV] Link de reset: ${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`
      );
    }
  }

  return NextResponse.json({
    ok: true,
    message: "Se o email existir, enviaremos instrucoes.",
  });
}
