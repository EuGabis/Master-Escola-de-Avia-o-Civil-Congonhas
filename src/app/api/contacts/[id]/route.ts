import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth/audit";
import { getClientIp, getUserAgent } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().min(8).max(20).regex(/^\d+$/).optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  notes: z.string().max(5000).nullable().optional(),
  courseInterest: z.enum(["PP", "PC", "Comissario", "INVA", "outro"]).nullable().optional(),
  source: z.enum(["website", "indicacao", "instagram", "google", "outro"]).nullable().optional(),
  status: z.enum(["lead", "aluno", "ex_aluno", "perdido"]).optional(),
});

async function ensure(id: string, workspaceId: string) {
  return db.contact.findFirst({
    where: { id, workspaceId },
    select: { id: true },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const contact = await db.contact.findFirst({
    where: { id, workspaceId: session.wid },
    include: {
      conversations: {
        orderBy: { lastMessageAt: "desc" },
        select: {
          id: true,
          status: true,
          lastMessage: true,
          lastMessageAt: true,
          unreadCount: true,
          labels: { include: { label: true } },
        },
      },
    },
  });
  if (!contact)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ contact });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await ensure(id, session.wid)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.issues[0]?.message ?? "Dados inválidos"
        : "Dados inválidos";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Normaliza email vazio
  const data: Record<string, unknown> = { ...body };
  if (body.email === "") data.email = null;

  try {
    const contact = await db.contact.update({ where: { id }, data });
    await audit({
      workspaceId: session.wid,
      userId: session.uid,
      action: "contact.update",
      target: id,
      meta: body,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    });
    return NextResponse.json({ contact });
  } catch (err) {
    if (err instanceof Error && err.message.toLowerCase().includes("unique constraint")) {
      return NextResponse.json(
        { error: "Já existe outro contato com esse telefone" },
        { status: 409 }
      );
    }
    throw err;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await ensure(id, session.wid)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.contact.delete({ where: { id } });
  await audit({
    workspaceId: session.wid,
    userId: session.uid,
    action: "contact.delete",
    target: id,
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
  });
  return NextResponse.json({ ok: true });
}
