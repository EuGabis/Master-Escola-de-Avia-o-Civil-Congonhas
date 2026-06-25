import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { redis } from "@/lib/redis";
import { pusher, channels, events as ev } from "@/lib/pusher";
import { normalizePhone, sendText } from "@/lib/evolution";
import {
  generateAIReply,
  checkStopCommand,
  getAgentConfigFresh,
} from "@/lib/ai";
import { runAutomations } from "@/lib/automation";
import { autoAssignAgent } from "@/lib/assign";
import { memo } from "@/lib/cache";
import { transcribeAudio } from "@/lib/transcribe";

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

  // 3) Resolve workspace pela instancia (cacheado 60s — evita ~300ms
  //    em cada mensagem recebida no whatsapp).
  const ws = await memo(
    `ws:instance:${instance}`,
    60_000,
    async () => {
      const found = await db.workspace.findFirst({
        where: { evolutionInstance: instance },
        select: { id: true, active: true },
      });
      if (found) return found;
      // Fallback: pega o workspace 'master' (cenario inicial com 1 ws)
      return db.workspace.findFirst({
        where: { slug: "master", active: true },
        select: { id: true, active: true },
      });
    }
  );

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

  // DEDUP: se ja existe Message com esse evolutionId, este webhook ja foi
  // processado antes (Evolution as vezes reenfileira em retry/timeout).
  // Sem este guard o handler reexecutava tudo, incluindo generateAIReply,
  // gerando respostas duplicadas. Conferir cedo antes de qualquer
  // mutacao no banco.
  const existing = await db.message.findUnique({
    where: { evolutionId: msg.key.id },
    select: { id: true },
  });
  if (existing) {
    console.log(`[webhook] msg duplicada (evolutionId=${msg.key.id}) — skip`);
    return;
  }

  // Extrai o conteudo conforme o tipo de mensagem
  const extracted = extractContent(
    msg,
    payload.data as { message?: { base64?: string }; messageBase64?: string }
  );
  let content = extracted.content;
  const { type, mediaUrl, mediaBase64, fileName } = extracted;

  // Transcreve nota de voz recebida pra IA entender e o CRM mostrar o texto.
  // Mantem type="audio" (player continua tocando) e troca o content "[audio]"
  // pelo que foi dito. Se nao transcrever, segue como audio normal.
  let audioTranscribed = false;
  if (direction === "in" && type === "audio" && mediaBase64) {
    const cfg = await getAgentConfigFresh(workspaceId);
    const transcript = await transcribeAudio(mediaBase64, cfg?.apiKey);
    if (transcript) {
      content = transcript;
      audioTranscribed = true;
    }
  }

  // Upsert do contato.
  // Em mensagens fromMe (saida nossa), o `pushName` da Evolution e o nome
  // do PROPRIO whatsapp da escola — nao do destinatario. Sobrescrever
  // com isso colocava todo mundo como "Master | Escola...". So usa o
  // pushName quando a mensagem e inbound (vinda do contato).
  const incomingPushName =
    !fromMe && msg.pushName?.trim() ? msg.pushName.trim() : null;
  const contact = await db.contact.upsert({
    where: { workspaceId_phone: { workspaceId, phone } },
    create: { workspaceId, phone, name: incomingPushName ?? phone },
    update: incomingPushName ? { name: incomingPushName } : {},
  });

  // Upsert da conversa
  let conversation = await db.conversation.findFirst({
    where: { workspaceId, contactId: contact.id },
  });
  if (!conversation) {
    // Se o Agente IA estiver ligado no workspace, ja nasce com IA ativada
    const agentCfg = await getAgentConfigFresh(workspaceId);
    conversation = await db.conversation.create({
      data: {
        workspaceId,
        contactId: contact.id,
        status: "open",
        channel: "whatsapp",
        aiEnabled: !!agentCfg?.enabled,
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

  // Se a conversa estava resolvida e o contato mandou mensagem, reabre.
  // SO mexe em status — NAO religa aiEnabled. Se o atendente quiser a IA
  // ativa na conversa que voltou, liga manualmente. Isso evita que o
  // sistema "religue sozinho" uma IA que o atendente tinha desligado.
  const reopened =
    direction === "in" && conversation.status === "resolved";

  // Atualiza preview da conversa
  const updatedConversation = await db.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessage: content.slice(0, 200),
      lastMessageAt: timestamp,
      unreadCount: fromMe ? conversation.unreadCount : conversation.unreadCount + 1,
      ...(reopened ? { status: "open" } : {}),
    },
  });
  // Reflete imediatamente no objeto em memoria para o resto do handler
  conversation = updatedConversation;

  if (reopened) {
    await pusher.trigger(channels.workspace(workspaceId), ev.conversationUpdate, {
      conversationId: conversation.id,
      status: "open",
    });
  }

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

    // Round-robin: atribui agente automaticamente na 1a mensagem
    if (incomingCount === 1) {
      await autoAssignAgent(workspaceId, conversation.id).catch(() => null);
    }
  }

  // === AGENTE IA ===
  // Responde automaticamente se:
  //  - mensagem eh do contato (in, nao fromMe)
  //  - texto OU audio que foi transcrito (content ja vira o texto falado)
  //  - conversa tem aiEnabled
  //  - nao eh comando de stop
  if (direction === "in" && (type === "text" || audioTranscribed)) {
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

    // LOCK: garante que so UMA lambda gera resposta IA pra essa conversa
    // por vez. Se o cliente manda 3 mensagens em rajada, sao 3 webhooks
    // paralelos. Sem o lock, gerariamos 3 respostas independentes. Com
    // ele, so a primeira passa; as outras pulam silenciosamente, e a
    // primeira (depois do delay) le o historico ja com as novas msgs
    // incluidas — entao a unica resposta cobre o contexto inteiro.
    //
    // TTL de 30s e maior que o tempo da chamada Anthropic + envio,
    // pra cobrir picos. Se a lambda crashar, o lock expira sozinho.
    const lockKey = `ai-lock:conv:${conversation.id}`;
    const got = await redis.set(lockKey, "1", { nx: true, ex: 30 });
    if (got !== "OK") {
      console.log(`[ai] lock ocupado p/ conv ${conversation.id} — skip`);
      return;
    }

    try {
      // Delay 1.5s para agrupar mensagens em rajada — se cliente manda
      // "oi", "tudo bem?", "tem aula?" em sequencia, todas estarao no
      // DB quando generateAIReply for ler o historico.
      await new Promise((r) => setTimeout(r, 1500));

      const reply = await generateAIReply({
        workspaceId,
        conversationId: conversation.id,
      });
      if (!reply || !reply.text) return;

      // Envia via Evolution
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
    } finally {
      // Libera o lock mesmo se deu erro — assim a proxima msg do cliente
      // pode ser respondida sem esperar o TTL de 30s expirar.
      await redis.del(lockKey).catch(() => null);
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

/**
 * Desempacota wrappers da Evolution (ephemeralMessage, viewOnceMessage,
 * editedMessage etc) ate chegar no payload "real" da mensagem. Suporta
 * aninhamento (uma msg pode ser efemera + view-once ao mesmo tempo).
 * Mantemos um limite de 5 niveis pra evitar loop em payload malformado.
 */
function unwrapMessage(
  m: EvolutionMessageBody,
  depth = 0
): EvolutionMessageBody {
  if (depth >= 5 || !m) return m;
  if (m.ephemeralMessage?.message)
    return unwrapMessage(m.ephemeralMessage.message, depth + 1);
  if (m.viewOnceMessage?.message)
    return unwrapMessage(m.viewOnceMessage.message, depth + 1);
  if (m.viewOnceMessageV2?.message)
    return unwrapMessage(m.viewOnceMessageV2.message, depth + 1);
  if (m.viewOnceMessageV2Extension?.message)
    return unwrapMessage(m.viewOnceMessageV2Extension.message, depth + 1);
  if (m.editedMessage?.message)
    return unwrapMessage(m.editedMessage.message, depth + 1);
  if (m.protocolMessage?.editedMessage)
    return unwrapMessage(m.protocolMessage.editedMessage, depth + 1);
  return m;
}

function extractContent(
  msg: EvolutionMessage,
  payloadData?: { message?: { base64?: string }; messageBase64?: string }
): {
  content: string;
  type: string;
  mediaUrl?: string;
  mediaBase64?: string;
  fileName?: string;
} {
  const m = unwrapMessage(msg.message ?? {});

  function pickBase64(typed?: { base64?: string; url?: string }): {
    mediaBase64?: string;
    mediaUrl?: string;
  } {
    const root = payloadData?.message?.base64 || payloadData?.messageBase64;
    const fromTyped = typed?.base64;
    const url = typed?.url;
    const b64 = fromTyped || root;
    return {
      mediaBase64: b64 ? toDataUrl(b64) : undefined,
      mediaUrl: url,
    };
  }

  // ===== TEXTO =====
  if (m.conversation) return { content: m.conversation, type: "text" };
  if (m.extendedTextMessage?.text)
    return { content: m.extendedTextMessage.text, type: "text" };

  // ===== MIDIAS =====
  if (m.imageMessage) {
    const media = pickBase64({
      base64: m.imageMessage.base64,
      url: m.imageMessage.url,
    });
    return {
      content: m.imageMessage.caption ?? "[imagem]",
      type: "image",
      ...media,
    };
  }
  if (m.videoMessage) {
    const media = pickBase64({
      base64: m.videoMessage.base64,
      url: m.videoMessage.url,
    });
    return {
      content: m.videoMessage.caption ?? "[video]",
      type: "video",
      ...media,
    };
  }
  if (m.audioMessage) {
    const media = pickBase64({
      base64: m.audioMessage.base64,
      url: m.audioMessage.url,
    });
    return { content: "[audio]", type: "audio", ...media };
  }
  if (m.documentMessage) {
    const media = pickBase64({
      base64: m.documentMessage.base64,
      url: m.documentMessage.url,
    });
    return {
      content: m.documentMessage.fileName ?? "[documento]",
      type: "document",
      fileName: m.documentMessage.fileName,
      ...media,
    };
  }
  if (m.stickerMessage) {
    const media = pickBase64({
      base64: m.stickerMessage.base64,
      url: m.stickerMessage.url,
    });
    return { content: "[figurinha]", type: "sticker", ...media };
  }

  // ===== REACOES (emoji) =====
  if (m.reactionMessage) {
    const emoji = m.reactionMessage.text?.trim();
    // Reacao vazia significa "removeu a reacao"
    if (!emoji) return { content: "↩ removeu a reação", type: "reaction" };
    return { content: `${emoji} reagiu à mensagem`, type: "reaction" };
  }

  // ===== INTERATIVAS (botoes / listas) =====
  if (m.buttonsResponseMessage) {
    const text =
      m.buttonsResponseMessage.selectedDisplayText ||
      m.buttonsResponseMessage.selectedButtonId ||
      "[botao]";
    return { content: text, type: "text" };
  }
  if (m.listResponseMessage) {
    const text =
      m.listResponseMessage.title ||
      m.listResponseMessage.singleSelectReply?.selectedRowId ||
      "[opcao da lista]";
    return { content: text, type: "text" };
  }
  if (m.templateButtonReplyMessage) {
    const text =
      m.templateButtonReplyMessage.selectedDisplayText ||
      m.templateButtonReplyMessage.selectedId ||
      "[resposta]";
    return { content: text, type: "text" };
  }
  if (m.interactiveResponseMessage) {
    return {
      content:
        m.interactiveResponseMessage.body?.text ?? "[resposta interativa]",
      type: "text",
    };
  }

  // ===== ENQUETES =====
  if (m.pollCreationMessage || m.pollCreationMessageV3) {
    const poll = m.pollCreationMessage ?? m.pollCreationMessageV3;
    const q = poll?.name ?? "Enquete";
    const opts = (poll?.options ?? [])
      .map((o) => o?.optionName)
      .filter(Boolean)
      .join(" · ");
    return {
      content: opts ? `📊 ${q} — ${opts}` : `📊 ${q}`,
      type: "poll",
    };
  }
  if (m.pollUpdateMessage) {
    return { content: "🗳 votou em uma enquete", type: "poll" };
  }

  // ===== OUTROS =====
  if (m.locationMessage) return { content: "📍 localização", type: "location" };
  if (m.contactMessage) return { content: "👤 cartão de contato", type: "contact" };
  if (m.contactsArrayMessage) {
    const n = m.contactsArrayMessage.contacts?.length ?? 0;
    return { content: `👤 ${n} contatos`, type: "contact" };
  }
  if (m.liveLocationMessage)
    return { content: "📍 localização em tempo real", type: "location" };

  // Mensagem foi DELETADA pelo remetente
  if (m.protocolMessage?.type === 0 || m.protocolMessage?.type === "REVOKE")
    return { content: "🚫 mensagem apagada", type: "deleted" };

  return { content: "[mensagem nao suportada]", type: "unknown" };
}

/**
 * Garante que valor base64 vira data URL completa.
 * Evolution as vezes manda 'iVBORw0KG...' puro, as vezes 'data:image/jpeg;base64,iVBO...'
 */
function toDataUrl(value: string): string {
  if (value.startsWith("data:")) return value;
  // Detecta mimetype pelos magic bytes do base64
  const start = value.slice(0, 20);
  let mime = "application/octet-stream";
  if (start.startsWith("/9j/")) mime = "image/jpeg";
  else if (start.startsWith("iVBOR")) mime = "image/png";
  else if (start.startsWith("R0lGOD")) mime = "image/gif";
  else if (start.startsWith("UklGR")) mime = "image/webp";
  else if (start.startsWith("AAAA") || start.startsWith("GkXf")) mime = "video/mp4";
  else if (start.startsWith("//uQ") || start.startsWith("T2dn")) mime = "audio/mpeg";
  else if (start.startsWith("JVBER")) mime = "application/pdf";
  return `data:${mime};base64,${value}`;
}

// ============================================================
// Tipos do payload da Evolution
// ============================================================

interface MediaPayload {
  caption?: string;
  fileName?: string;
  base64?: string;
  url?: string;
  mimetype?: string;
}

interface PollOption {
  optionName?: string;
}

interface PollPayload {
  name?: string;
  options?: PollOption[];
}

/**
 * Estrutura recursiva — wrappers (ephemeral/viewOnce/edited) contem
 * um sub-`message` do mesmo formato. unwrapMessage() faz a recursao.
 */
interface EvolutionMessageBody {
  conversation?: string;
  extendedTextMessage?: { text: string };
  imageMessage?: MediaPayload;
  videoMessage?: MediaPayload;
  audioMessage?: MediaPayload;
  documentMessage?: MediaPayload;
  stickerMessage?: MediaPayload;
  locationMessage?: object;
  liveLocationMessage?: object;
  contactMessage?: object;
  contactsArrayMessage?: { contacts?: unknown[] };
  reactionMessage?: { text?: string; key?: { id?: string } };
  buttonsResponseMessage?: {
    selectedButtonId?: string;
    selectedDisplayText?: string;
  };
  listResponseMessage?: {
    title?: string;
    singleSelectReply?: { selectedRowId?: string };
  };
  templateButtonReplyMessage?: {
    selectedId?: string;
    selectedDisplayText?: string;
  };
  interactiveResponseMessage?: { body?: { text?: string } };
  pollCreationMessage?: PollPayload;
  pollCreationMessageV3?: PollPayload;
  pollUpdateMessage?: object;
  // Wrappers que envolvem outra mensagem
  ephemeralMessage?: { message?: EvolutionMessageBody };
  viewOnceMessage?: { message?: EvolutionMessageBody };
  viewOnceMessageV2?: { message?: EvolutionMessageBody };
  viewOnceMessageV2Extension?: { message?: EvolutionMessageBody };
  editedMessage?: { message?: EvolutionMessageBody };
  protocolMessage?: {
    type?: number | string;
    editedMessage?: EvolutionMessageBody;
  };
  base64?: string;
}

interface EvolutionMessage {
  key: { id: string; remoteJid: string; fromMe?: boolean };
  pushName?: string;
  messageTimestamp?: number;
  message?: EvolutionMessageBody;
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
