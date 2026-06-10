import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { pusher, channels, events as ev } from "@/lib/pusher";
import { sendText } from "@/lib/evolution";

export const dynamic = "force-dynamic";

/**
 * GET  /api/conversations/[id]/messages  -> ultimas 50 (metadata + texto, SEM base64)
 * POST /api/conversations/[id]/messages  -> envia nova mensagem (out)
 *
 * IMPORTANTE: mediaBase64 NAO eh retornado aqui (pode ter MBs por mensagem).
 * O cliente fetch-a a midia sob demanda via GET /api/messages/[id]/media.
 * Retornamos `hasMedia: true` quando ha midia, pra UI saber que precisa buscar.
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Em paralelo: valida ownership + busca mensagens + zera unread.
  // Tres queries independentes — Promise.all corta latencia.
  const [conv, latest] = await Promise.all([
    db.conversation.findFirst({
      where: { id, workspaceId: session.wid },
      select: { id: true },
    }),
    db.message.findMany({
      where: { conversationId: id },
      orderBy: { timestamp: "desc" },
      take: 50,
      select: {
        id: true,
        content: true,
        type: true,
        direction: true,
        status: true,
        timestamp: true,
        fileName: true,
        mediaUrl: true,
        evolutionId: true,
        senderId: true,
        // Sender (agente humano) so vem em msgs out enviadas pelo painel.
        // Mensagens out enviadas pela IA tem senderId=null — UI mostra
        // avatar de "Bot" nesse caso. Mensagens in nao tem sender (e o
        // proprio contato, e a UI usa o avatar do contato da conversa).
        sender: { select: { id: true, name: true, avatar: true } },
        // mediaBase64 OMITIDO de proposito (pesado)
      },
    }),
  ]);

  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Indica quais mensagens TEM midia (sem trazer o conteudo)
  const needHasMedia = latest.some(
    (m) => m.type !== "text" && m.type !== "unknown" && !m.mediaUrl
  );
  const hasMediaMap = needHasMedia
    ? await db.message.findMany({
        where: { id: { in: latest.map((m) => m.id) } },
        select: { id: true, mediaBase64: true },
      })
    : [];
  const mediaIds = new Set(
    hasMediaMap.filter((m) => m.mediaBase64).map((m) => m.id)
  );

  const messages = latest
    .map((m) => ({
      ...m,
      mediaBase64: null,
      hasMedia: m.mediaUrl ? true : mediaIds.has(m.id),
    }))
    .reverse();

  // Zera unread em background (nao bloqueia resposta)
  void db.conversation
    .update({ where: { id }, data: { unreadCount: 0 } })
    .catch(() => null);

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
    select: {
      id: true,
      contact: { select: { phone: true } },
    },
  });
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Envia via Evolution
  let evolutionId: string | undefined;
  try {
    const result = await sendText({
      number: conv.contact.phone,
      text: body.text,
    });
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

  // Update preview e Pusher em paralelo, sem bloquear retorno
  void Promise.all([
    db.conversation.update({
      where: { id },
      data: {
        lastMessage: body.text.slice(0, 200),
        lastMessageAt: new Date(),
      },
    }),
    pusher.trigger(channels.conversation(id), ev.messageNew, {
      id: message.id,
      content: message.content,
      type: "text",
      direction: "out",
      status: "sent",
      timestamp: message.timestamp.toISOString(),
    }),
  ]).catch((err) => console.error("[send] post-publish:", err));

  return NextResponse.json({ message });
}
