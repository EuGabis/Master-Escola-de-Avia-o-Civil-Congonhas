import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { pusher, channels, events as ev } from "@/lib/pusher";
import { audit } from "@/lib/auth/audit";
import { getClientIp, getUserAgent } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

const schema = z.object({
  userId: z.string().min(1).nullable(),
});

async function ensureConv(id: string, workspaceId: string) {
  return db.conversation.findFirst({
    where: { id, workspaceId },
    select: { id: true },
  });
}

/**
 * POST /api/conversations/[id]/assign  body: { userId } -> atribui (substitui anteriores)
 * DELETE /api/conversations/[id]/assign?userId=...      -> remove atribuicao
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await ensureConv(id, session.wid)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }

  if (body.userId === null) {
    // remove todas as atribuicoes
    await db.conversationAssignment.deleteMany({
      where: { conversationId: id },
    });
  } else {
    const user = await db.user.findFirst({
      where: { id: body.userId, workspaceId: session.wid },
      select: { id: true, name: true, color: true },
    });
    if (!user)
      return NextResponse.json({ error: "Usuario invalido" }, { status: 400 });

    // Substitui atribuicoes anteriores
    await db.$transaction([
      db.conversationAssignment.deleteMany({ where: { conversationId: id } }),
      db.conversationAssignment.create({
        data: { conversationId: id, userId: body.userId },
      }),
    ]);

    await pusher.trigger(channels.conversation(id), ev.conversationAssigned, {
      conversationId: id,
      user,
    });
  }

  await audit({
    workspaceId: session.wid,
    userId: session.uid,
    action: "conversation.assign",
    target: id,
    meta: { assignedUserId: body.userId },
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
  });

  return NextResponse.json({ ok: true });
}
