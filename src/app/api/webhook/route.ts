import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { pusher, channels, events as ev } from "@/lib/pusher";
import { normalizePhone, sendText } from "@/lib/evolution";
import { generateAIReply, checkStopCommand } from "@/lib/ai";
import { runAutomations } from "@/lib/automation";

/**
 * Webhook receiver da Evolution API.
 *
 * SEGURANCA:
 *   A Evolution envia o header `apikey` com a mesma key da instancia.
 *   Comparamos contra EVOLUTION_API_KEY do .env. Se nao bater, 401.
 *
 * IDEMPOTENCIA:
 *   Mensagens tem um `key.id` (evolutionId). Salvamos com @unique - duplicatas
 *   sao ignoradas silenciosamente.
 *
 * EVENTOS suportados (por enquanto):
 *   - messages.upsert (mensagem nova recebida ou enviada)
 *   - messages.update (status: enviada, entregue, lida)
 *   - connection.update (status da conexao do whatsapp)
 *
 * Outros eventos sao aceitos mas ignorados.
 */
export async function POST(req: NextRequest) {
  // 1) Autenticacao por apikey header
  const apikey = req.headers.get("apikey");
  if (!apikey || apikey !== env.EVOLUTION_API_KEY) {
    console.warn("[webhook] apikey invalida");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Parse do payload
  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = payload.event;
  const instance = payload.instance;

  // 3) Resolve workspace pela instancia
  const workspace = await db.workspace.findFirst({
    where: { evolutionInstance: instance },
    select: { id: true, active: true },
  });

  // Se nenhum workspace tem essa instancia ainda, tentamos o admin default
  // (util na fase inicial onde so existe um workspace)
  const ws =
    workspace ??
    (await db.workspace.findFirst({
      where: { slug: "master", active: true },
      select: { id: true, active: true },
    }));

  if (!ws) {
    console.warn(`[webhook] workspace nao encontrado para instancia ${instance}`);
    return NextResponse.json({ ok: true, skipped: "no_workspace" });
  }

  try {
    switch (event) {
      case "messages.upsert":
        await handleMessageUpsert(ws.id, payload);
        break;
      case "messages.update":
        await handleMessageUpdate(ws.id, payload);
        break;
      case "connection.update":
        await handleConnectionUpdate(ws.id, payload);
        break;
      default:
        // Eventos nao tratados (presence.update, contacts.upsert, etc) - ignora
        break;
    }
  } catch (err) {
    console.error(`[webhook] erro processando ${event}:`, err);
    // Retornamos 200 mesmo em erro pra Evolution nao reenfileirar infinitamente.
    // Logamos pra investigar depois.
    return NextResponse.json({ ok: false, error: "internal" });
  }

  return NextResponse.json({ ok: true });
}

// ============================================================
// Handlers de evento
// ============================================================

async function handleMessageUpsert(workspaceId: string, payload: WebhookPayload) {
  const msg = payload.data;
  if (!msg?.key?.id || !msg?.key?.remoteJid) return;

  // Ignora mensagens de grupo por enquanto (foco: 1-1)
  if (msg.key.remoteJid.endsWith("@g.us")) return;

  const phone = normalizePhone(msg.key.remoteJid);
  const fromMe = !!msg.key.fromMe;
  const direction = fromMe ? "out" : "in";

  // Extrai o conteudo conforme o tipo de mensagem
  const { content, type, mediaUrl, mediaBase64, fileName } = extractContent(msg);

  // Upsert do contato
  const pushName = msg.pushName?.trim() || phone;
  const contact = await db.contact.upsert({
    where: { workspaceId_phone: { workspaceId, phone } },
    create: { workspaceId, phone, name: pushName },
    update: { name: pushName },
  });

  // Upsert da conversa
  let conversation = await db.conversation.findFirst({
    where: { workspaceId, contactId: contact.id },
  });
  if (!conversation) {
    conversation = await db.conversation.create({
      data: {
        workspaceId,
        contactId: contact.id,
        status: "open",
        channel: "whatsapp",
      },
    });
  }

  // Cria mensagem (idempotente via evolutionId @unique)
  const timestamp = msg.messageTimestamp
    ? new Date(msg.messageTimestamp * 1000)
    : new Date();

  const message = await db.message.upsert({
    where: { evolutionId: msg.key.id },
    create: {
      evolutionId: msg.key.id,
      conversationId: conversation.id,
      content,
      type,
      direction,
      status: fromMe ? "sent" : "delivered",
      mediaUrl,
      mediaBase64,
      fileName,
      timestamp,
    },
    update: {}, // se ja existe, nao mexe (idempotencia)
  });

  // Atualiza preview da conversa
  await db.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessage: content.slice(0, 200),
      lastMessageAt: timestamp,
      unreadCount: fromMe ? conversation.unreadCount : conversation.unreadCount + 1,
    },
  });

  // Publica no Pusher para a UI receber em tempo real
  await pusher.trigger(channels.workspace(workspaceId), ev.messageNew, {
    conversationId: conversation.id,
    messageId: message.id,
    direction,
    content: content.slice(0, 200),
    timestamp: timestamp.toISOString(),
  });

  await pusher.trigger(channels.conversation(conversation.id), ev.messageNew, {
    id: message.id,
    content,
    type,
    direction,
    status: message.status,
    mediaUrl,
    fileName,
    timestamp: timestamp.toISOString(),
  });

  // === AUTOMATIONS ===
  // Rodam APENAS em mensagens recebidas (in), nao em respostas nossas.
  if (direction === "in") {
    // Conta total de mensagens IN dessa conversa: se for 1, eh primeira mensagem
    const incomingCount = await db.message.count({
      where: { conversationId: conversation.id, direction: "in" },
    });
    await runAutomations({
      workspaceId,
      conversationId: conversation.id,
      contactName: contact.name,
      messageContent: content,
      isFirstMessage: incomingCount === 1,
    });
  }

  // === AGENTE IA ===
  // Responde automaticamente se:
  //  - mensagem eh do contato (in, nao fromMe)
  //  - texto (nao audio/video etc)
  //  - conversa tem aiEnabled
  //  - nao eh comando de stop
  if (direction === "in" && type === "text") {
    // Recarrega conversa (status pode ter mudado)
    const conv = await db.conversation.findUnique({
      where: { id: conversation.id },
      select: { aiEnabled: true, status: true },
    });

    if (!conv) return;

    // Detecta /humano - desliga IA + status pending
    const stopped = await checkStopCommand(workspaceId, conversation.id, content);
    if (stopped) {
      await pusher.trigger(channels.workspace(workspaceId), ev.conversationUpdate, {
        conversationId: conversation.id,
        status: "pending",
        aiEnabled: false,
      });
      return;
    }

    if (!conv.aiEnabled) return;

    // Pequeno delay para parecer mais humano (300ms)
    await new Promise((r) => setTimeout(r, 300));

    const reply = await generateAIReply({
      workspaceId,
      conversationId: conversation.id,
    });
    if (!reply || !reply.text) return;

    // Envia via Evolution
    try {
      const sendResult = await sendText({
        number: phone,
        text: reply.text,
      });
      const evolutionId = (sendResult as { key?: { id?: string } })?.key?.id;

      const aiMsg = await db.message.create({
        data: {
          conversationId: conversation.id,
          content: reply.text,
          type: "text",
          direction: "out",
          status: "sent",
          evolutionId,
          timestamp: new Date(),
        },
      });

      await db.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessage: reply.text.slice(0, 200),
          lastMessageAt: new Date(),
        },
      });

      await pusher.trigger(channels.conversation(conversation.id), ev.messageNew, {
        id: aiMsg.id,
        content: reply.text,
        type: "text",
        direction: "out",
        status: "sent",
        timestamp: aiMsg.timestamp.toISOString(),
      });
      await pusher.trigger(channels.workspace(workspaceId), ev.messageNew, {
        conversationId: conversation.id,
        direction: "out",
        content: reply.text.slice(0, 200),
      });
    } catch (err) {
      console.error("[ai] erro ao enviar resposta IA:", err);
    }
  }
}

async function handleMessageUpdate(workspaceId: string, payload: WebhookPayload) {
  const upd = payload.data;
  if (!upd?.key?.id || !upd?.update?.status) return;

  // Evolution manda status como string em algumas versoes, numero em outras
  const statusRaw = upd.update.status;
  const mapped =
    typeof statusRaw === "string"
      ? statusRaw.toLowerCase()
      : ({ 2: "sent", 3: "delivered", 4: "read", 5: "played" } as Record<
          string,
          string
        >)[String(statusRaw)] ?? "sent";

  const message = await db.message.update({
    where: { evolutionId: upd.key.id },
    data: { status: mapped },
    select: { id: true, conversationId: true },
  }).catch(() => null);

  if (!message) return;

  await pusher.trigger(channels.conversation(message.conversationId), ev.messageStatus, {
    id: message.id,
    status: mapped,
  });
}

async function handleConnectionUpdate(workspaceId: string, payload: WebhookPayload) {
  const state = payload.data?.state ?? "unknown";
  await pusher.trigger(channels.workspace(workspaceId), "connection:update", {
    state,
  });
}

// ============================================================
// Extracao de conteudo do payload Evolution
// ============================================================

function extractContent(msg: EvolutionMessage): {
  content: string;
  type: string;
  mediaUrl?: string;
  mediaBase64?: string;
  fileName?: string;
} {
  const m = msg.message ?? {};

  if (m.conversation) {
    return { content: m.conversation, type: "text" };
  }
  if (m.extendedTextMessage?.text) {
    return { content: m.extendedTextMessage.text, type: "text" };
  }
  if (m.imageMessage) {
    return {
      content: m.imageMessage.caption ?? "[imagem]",
      type: "image",
      mediaBase64: msg.message?.base64 ?? undefined,
    };
  }
  if (m.videoMessage) {
    return {
      content: m.videoMessage.caption ?? "[video]",
      type: "video",
      mediaBase64: msg.message?.base64 ?? undefined,
    };
  }
  if (m.audioMessage) {
    return { content: "[audio]", type: "audio", mediaBase64: msg.message?.base64 ?? undefined };
  }
  if (m.documentMessage) {
    return {
      content: m.documentMessage.fileName ?? "[documento]",
      type: "document",
      fileName: m.documentMessage.fileName,
      mediaBase64: msg.message?.base64 ?? undefined,
    };
  }
  if (m.stickerMessage) {
    return { content: "[sticker]", type: "sticker" };
  }
  if (m.locationMessage) {
    return { content: "[localizacao]", type: "location" };
  }
  if (m.contactMessage) {
    return { content: "[contato]", type: "contact" };
  }
  return { content: "[mensagem nao suportada]", type: "unknown" };
}

// ============================================================
// Tipos do payload da Evolution
// ============================================================

interface EvolutionMessage {
  key: { id: string; remoteJid: string; fromMe?: boolean };
  pushName?: string;
  messageTimestamp?: number;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text: string };
    imageMessage?: { caption?: string };
    videoMessage?: { caption?: string };
    audioMessage?: object;
    documentMessage?: { fileName?: string };
    stickerMessage?: object;
    locationMessage?: object;
    contactMessage?: object;
    base64?: string;
  };
}

interface WebhookPayload {
  event: string;
  instance: string;
  // O `data` varia conforme o evento
  data: EvolutionMessage & {
    state?: string;
    update?: { status?: string | number };
  };
}
