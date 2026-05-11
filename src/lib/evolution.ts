import { env } from "./env";

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
      text: args.text,
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
      caption: args.caption,
      fileName: args.fileName,
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
// Helpers de telefone (E164 sem +)
// ============================================================

/**
 * Converte "5511974694344@s.whatsapp.net" -> "5511974694344"
 * Converte "551197469-4344" -> "5511974694344"
 */
export function normalizePhone(input: string): string {
  return input.replace(/@.*$/, "").replace(/\D/g, "");
}
