import OpenAI, { toFile } from "openai";
import { env } from "@/lib/env";

/**
 * Transcrição de áudio (notas de voz do WhatsApp) via OpenAI Whisper.
 *
 * Por quê: a Evolution entrega áudio como mídia base64, então a IA recebia
 * só "[audio]" e respondia no escuro. Transcrevendo, o texto vira o conteúdo
 * da mensagem — a Valentina entende a voz e o CRM mostra o que foi dito.
 *
 * Chave usada (Whisper é só OpenAI):
 *   1. env.OPENAI_API_KEY (dedicada), ou
 *   2. a apiKey do AgentConfig se ela for OpenAI (sk-..., não sk-ant-).
 * Sem chave OpenAI disponível, retorna null e o fluxo segue normalmente
 * (a regra do prompt pede que a pessoa escreva por texto).
 */

/** Mime (do data URL) -> extensão que o Whisper aceita. */
function extFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("ogg") || m.includes("opus")) return "ogg";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "m4a";
  if (m.includes("wav")) return "wav";
  if (m.includes("webm")) return "webm";
  return "ogg"; // PTT do WhatsApp é opus em container ogg
}

function resolveKey(fallbackKey?: string | null): string | undefined {
  if (env.OPENAI_API_KEY) return env.OPENAI_API_KEY;
  if (
    fallbackKey &&
    fallbackKey.startsWith("sk-") &&
    !fallbackKey.startsWith("sk-ant-")
  ) {
    return fallbackKey;
  }
  return undefined;
}

/**
 * Transcreve um áudio em data URL base64. Retorna o texto ou null.
 *
 * @param dataUrl     ex: "data:audio/ogg;base64,T2dn..."
 * @param fallbackKey apiKey do AgentConfig (usada se não houver OPENAI_API_KEY)
 */
export async function transcribeAudio(
  dataUrl: string,
  fallbackKey?: string | null
): Promise<string | null> {
  const apiKey = resolveKey(fallbackKey);
  if (!apiKey || !dataUrl) return null;

  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl);
  const mime = match?.[1] ?? "audio/ogg";
  const b64 = match?.[2] ?? dataUrl;
  if (!b64) return null;

  try {
    const client = new OpenAI({ apiKey });
    const file = await toFile(Buffer.from(b64, "base64"), `audio.${extFromMime(mime)}`);
    const res = await client.audio.transcriptions.create({
      file,
      model: env.TRANSCRIBE_MODEL || "whisper-1",
      language: "pt",
    });
    const text = (res.text || "").trim();
    return text || null;
  } catch (err) {
    console.error("[transcribe] erro:", err);
    return null;
  }
}
