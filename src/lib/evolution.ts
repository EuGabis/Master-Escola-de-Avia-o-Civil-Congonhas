import { env } from "./env";
import { toWhatsAppFormat } from "./whatsapp-format";

/**
 * Cliente para a Evolution API (Cloudfy).
 *
 * Docs: https://doc.evolution-api.com/
 *
 * Toda chamada usa o header `apikey`. NUNCA expor essa key no frontend.
 */

interface EvolutionInstance {
  name: string;
  url: string;
  apiKey: string;
}

function getInstance(): EvolutionInstance {
  return {
    name: env.EVOLUTION_INSTANCE_NAME,
    url: env.EVOLUTION_API_URL.replace(/\/$/, ""),
    apiKey: env.EVOLUTION_API_KEY,
  };
}

async function callEvolution<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const { url, apiKey } = getInstance();
  if (!url || !apiKey) {
    throw new Error("Evolution API nao configurada (EVOLUTION_API_URL/KEY)");
  }
  const res = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(
      `Evolution ${path} retornou ${res.status}: ${
        typeof data === "string" ? data : JSON.stringify(data)
      }`
    );
  }
  return data as T;
}

// ============================================================
// Envio de mensagens
// ============================================================

interface SendTextArgs {
  number: string; // ex: "5511974694344" (so digitos, com codigo do pais)
  text: string;
  quotedMessageId?: string;
}

export async function sendText(args: SendTextArgs) {
  const { name } = getInstance();
  return callEvolution(`/message/sendText/${encodeURIComponent(name)}`, {
    method: "POST",
    body: JSON.stringify({
      number: args.number,
      // Rede de seguranca: normaliza Markdown -> WhatsApp em TODO envio de
      // texto (IA, followups, mensagens manuais). Idempotente.
      text: toWhatsAppFormat(args.text),
      ...(args.quotedMessageId && {
        quoted: { key: { id: args.quotedMessageId } },
      }),
    }),
  });
}

interface SendMediaArgs {
  number: string;
  mediaUrl: string;
  caption?: string;
  fileName?: string;
  mediaType: "image" | "video" | "document" | "audio";
}

export async function sendMedia(args: SendMediaArgs) {
  const { name } = getInstance();
  return callEvolution(`/message/sendMedia/${encodeURIComponent(name)}`, {
    method: "POST",
    body: JSON.stringify({
      number: args.number,
      mediatype: args.mediaType,
      media: args.mediaUrl,
      caption: args.caption ? toWhatsAppFormat(args.caption) : args.caption,
      fileName: args.fileName,
    }),
  });
}

interface SendAudioArgs {
  number: string;
  /** Data URL base64 OU URL http. Evolution aceita ambos no campo `audio`. */
  audio: string;
}

/**
 * Envia uma nota de voz (PTT). Diferente de sendMedia type=audio,
 * /message/sendWhatsAppAudio entrega como mensagem de voz nativa do
 * whatsapp (visual de microfone + waveform), nao como arquivo de audio.
 */
export async function sendWhatsAppAudio(args: SendAudioArgs) {
  const { name } = getInstance();
  return callEvolution(`/message/sendWhatsAppAudio/${encodeURIComponent(name)}`, {
    method: "POST",
    body: JSON.stringify({
      number: args.number,
      audio: args.audio,
    }),
  });
}

// ============================================================
// Configuracao do webhook
// ============================================================

export async function setWebhook(targetUrl: string, events: string[]) {
  const { name } = getInstance();
  return callEvolution(`/webhook/set/${encodeURIComponent(name)}`, {
    method: "POST",
    body: JSON.stringify({
      url: targetUrl,
      enabled: true,
      webhookByEvents: false,
      webhookBase64: true,
      events,
    }),
  });
}

// ============================================================
// Contatos (sincronizar nomes do whatsapp)
// ============================================================

interface EvolutionContact {
  id?: string;            // jid: "5511974694344@s.whatsapp.net"
  remoteJid?: string;
  pushName?: string;
  name?: string;          // nome salvo no whatsapp da escola (agenda)
  verifiedName?: string;  // whatsapp business
  notify?: string;        // algumas versoes mandam aqui
  profilePicUrl?: string;
}

interface EvolutionChat {
  id?: string;
  remoteJid?: string;
  pushName?: string;
  name?: string;
  notify?: string;
}

function unwrapList<T>(data: unknown, key: string): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj[key])) return obj[key] as T[];
    if (Array.isArray(obj.records)) return obj.records as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

/**
 * Lista contatos conhecidos pela Evolution.
 * Endpoint: POST /chat/findContacts/{instance}
 */
export async function findContacts(): Promise<EvolutionContact[]> {
  const { name } = getInstance();
  const data = await callEvolution<unknown>(
    `/chat/findContacts/${encodeURIComponent(name)}`,
    { method: "POST", body: JSON.stringify({ where: {} }) }
  );
  return unwrapList<EvolutionContact>(data, "contacts");
}

/**
 * Lista chats conhecidos pela Evolution. Em algumas versoes o `pushName`
 * vem aqui (e nao em findContacts), entao usamos como fonte alternativa.
 * Endpoint: POST /chat/findChats/{instance}
 */
export async function findChats(): Promise<EvolutionChat[]> {
  const { name } = getInstance();
  const data = await callEvolution<unknown>(
    `/chat/findChats/${encodeURIComponent(name)}`,
    { method: "POST", body: JSON.stringify({ where: {} }) }
  );
  return unwrapList<EvolutionChat>(data, "chats");
}

/**
 * Extrai o melhor nome possivel de um objeto vindo da Evolution.
 * Ordem de preferencia: pushName (perfil do contato) > verifiedName
 * (whatsapp business) > notify > name (nome da agenda local).
 */
export function pickEvolutionName(
  c: { pushName?: string; verifiedName?: string; notify?: string; name?: string }
): string | null {
  const candidates = [c.pushName, c.verifiedName, c.notify, c.name];
  for (const v of candidates) {
    const t = v?.trim();
    if (t) return t;
  }
  return null;
}

// ============================================================
// Helpers de telefone (E164 sem +)
// ============================================================

/**
 * Converte "5511974694344@s.whatsapp.net" -> "5511974694344"
 * Converte "551197469-4344" -> "5511974694344"
 */
export function normalizePhone(input: string): string {
  return input.replace(/@.*$/, "").replace(/\D/g, "");
}
