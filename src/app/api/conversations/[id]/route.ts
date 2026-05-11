import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth/audit";
import { getClientIp, getUserAgent } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(["open", "pending", "resolved", "snoozed"]).optional(),
  aiEnabled: z.boolean().optional(),
});

/**
 * GET /api/conversations/[id]
 * Detalhes da conversa + labels + assignments
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const conv = await db.conversation.findFirst({
    where: { id, workspaceId: session.wid },
    include: {
      contact: true,
      labels: { include: { label: true } },
      assignments: { include: { user: { select: { id: true, name: true, color: true, avatar: true } } } },
      kanbanCard: { include: { column: { select: { id: true, name: true, color: true } } } },
    },
  });

  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ conversation: conv });
}

/**
 * PATCH /api/conversations/[id]
 * Atualiza status / aiEnabled
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const conv = await db.conversation.findFirst({
    where: { id, workspaceId: session.wid },
    select: { id: true },
  });
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }

  const updated = await db.conversation.update({
    where: { id },
    data: body,
  });

  await audit({
    workspaceId: session.wid,
    userId: session.uid,
    action: "conversation.update",
    target: id,
    meta: body,
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
  });

  return NextResponse.json({ conversation: updated });
}
