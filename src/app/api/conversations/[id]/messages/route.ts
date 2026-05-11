import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { pusher, channels, events as ev } from "@/lib/pusher";
import { sendText } from "@/lib/evolution";

export const dynamic = "force-dynamic";

/**
 * GET  /api/conversations/[id]/messages  -> ultimas 50 mensagens
 * POST /api/conversations/[id]/messages  -> envia nova mensagem (out)
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const conv = await db.conversation.findFirst({
    where: { id, workspaceId: session.wid },
    select: { id: true },
  });
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = await db.message.findMany({
    where: { conversationId: id },
    orderBy: { timestamp: "asc" },
    take: 50,
  });

  // Marca como lidas (zera unread)
  await db.conversation.update({
    where: { id },
    data: { unreadCount: 0 },
  });

  return NextResponse.json({ messages });
}

const sendSchema = z.object({
  text: z.string().min(1).max(4000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: z.infer<typeof sendSchema>;
  try {
    body = sendSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Texto invalido" }, { status: 400 });
  }

  const conv = await db.conversation.findFirst({
    where: { id, workspaceId: session.wid },
    include: { contact: true },
  });
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Envia via Evolution
  let evolutionId: string | undefined;
  try {
    const result = await sendText({
      number: conv.contact.phone,
      text: body.text,
    });
    // Evolution retorna { key: { id: "..." } } no sucesso
    evolutionId = (result as { key?: { id?: string } })?.key?.id;
  } catch (err) {
    console.error("[send] erro Evolution:", err);
    return NextResponse.json(
      { error: "Falha ao enviar mensagem" },
      { status: 502 }
    );
  }

  // Salva localmente como "out"
  const message = await db.message.create({
    data: {
      conversationId: id,
      senderId: session.uid,
      content: body.text,
      type: "text",
      direction: "out",
      status: "sent",
      evolutionId,
      timestamp: new Date(),
    },
  });

  await db.conversation.update({
    where: { id },
    data: {
      lastMessage: body.text.slice(0, 200),
      lastMessageAt: new Date(),
    },
  });

  await pusher.trigger(channels.conversation(id), ev.messageNew, {
    id: message.id,
    content: message.content,
    type: "text",
    direction: "out",
    status: "sent",
    timestamp: message.timestamp.toISOString(),
  });

  return NextResponse.json({ message });
}
