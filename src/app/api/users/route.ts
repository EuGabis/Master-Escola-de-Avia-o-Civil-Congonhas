import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hashPassword, isPasswordStrong } from "@/lib/auth/password";
import { audit } from "@/lib/auth/audit";
import { getClientIp, getUserAgent } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await db.user.findMany({
    where: { workspaceId: session.wid },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      color: true,
      isOnline: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ users });
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(12).max(200),
  role: z.enum(["owner", "admin", "agent"]).default("agent"),
});

const COLORS = ["#F26522", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#06b6d4"];

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // So owner/admin pode criar agentes
  if (session.role !== "owner" && session.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem criar agentes" },
      { status: 403 }
    );
  }

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }

  const strong = isPasswordStrong(body.password);
  if (!strong.ok)
    return NextResponse.json({ error: strong.reason }, { status: 400 });

  const existing = await db.user.findUnique({ where: { email: body.email } });
  if (existing)
    return NextResponse.json(
      { error: "Email ja esta em uso" },
      { status: 409 }
    );

  const hash = await hashPassword(body.password);
  const user = await db.user.create({
    data: {
      workspaceId: session.wid,
      name: body.name.trim(),
      email: body.email,
      password: hash,
      role: body.role,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
    },
    select: { id: true, name: true, email: true, role: true, color: true },
  });

  await audit({
    workspaceId: session.wid,
    userId: session.uid,
    action: "user.create",
    target: user.id,
    meta: { email: user.email, role: user.role },
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
  });

  return NextResponse.json({ user });
}
