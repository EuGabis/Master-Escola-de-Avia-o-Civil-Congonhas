import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { sendMedia } from "@/lib/evolution";
import { pusher, channels, events as ev } from "@/lib/pusher";

export const dynamic = "force-dynamic";

const schema = z.object({
  mediaType: z.enum(["image", "video", "document", "audio"]),
  mediaDataUrl: z.string().startsWith("data:").max(20_000_000), // ~15MB base64
  fileName: z.string().max(200).optional(),
  caption: z.string().max(1024).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const conv = await db.conversation.findFirst({
    where: { id, workspaceId: session.wid },
    include: { contact: true },
  });
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Arquivo inválido ou muito grande (máx 15MB)" },
      { status: 400 }
    );
  }

  // Envia via Evolution
  let evolutionId: string | undefined;
  try {
    const result = await sendMedia({
      number: conv.contact.phone,
      mediaUrl: body.mediaDataUrl, // Evolution aceita data URL
      mediaType: body.mediaType,
      fileName: body.fileName,
      caption: body.caption,
    });
    evolutionId = (result as { key?: { id?: string } })?.key?.id;
  } catch (err) {
    console.error("[media] erro Evolution:", err);
    return NextResponse.json(
      { error: "Falha ao enviar mídia" },
      { status: 502 }
    );
  }

  // Salva localmente (base64 sem o prefixo "data:..." se for muito grande, salvamos data URL inteira)
  const content = body.caption?.trim() || `[${body.mediaType}]`;
  const message = await db.message.create({
    data: {
      conversationId: id,
      senderId: session.uid,
      content,
      type: body.mediaType,
      direction: "out",
      status: "sent",
      mediaBase64: body.mediaDataUrl,
      fileName: body.fileName,
      evolutionId,
      timestamp: new Date(),
    },
  });

  await db.conversation.update({
    where: { id },
    data: {
      lastMessage: content.slice(0, 200),
      lastMessageAt: new Date(),
    },
  });

  await pusher.trigger(channels.conversation(id), ev.messageNew, {
    id: message.id,
    content,
    type: body.mediaType,
    direction: "out",
    status: "sent",
    mediaBase64: body.mediaDataUrl,
    fileName: body.fileName,
    timestamp: message.timestamp.toISOString(),
  });

  return NextResponse.json({ message });
}
