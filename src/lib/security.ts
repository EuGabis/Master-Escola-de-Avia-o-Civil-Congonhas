/**
 * Utilitarios de seguranca compartilhados.
 */

// MIME types aceitos em upload de midia
const ALLOWED_MIME = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  audio: [
    "audio/mpeg",
    "audio/mp3",
    "audio/ogg",
    "audio/wav",
    "audio/webm",
    "audio/mp4",
  ],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
  ],
};

export function validateMediaDataUrl(
  dataUrl: string,
  expectedType: "image" | "video" | "audio" | "document"
): { ok: boolean; reason?: string } {
  // Formato: data:<mime>;base64,<payload>
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return { ok: false, reason: "Formato invalido - precisa ser data URL base64" };
  }
  const [, mime] = match;
  const allowed = ALLOWED_MIME[expectedType];
  if (!allowed.includes(mime!.toLowerCase())) {
    return {
      ok: false,
      reason: `Tipo de arquivo nao permitido (${mime}). Aceitos: ${allowed.join(", ")}`,
    };
  }
  return { ok: true };
}

/**
 * Sanitiza texto removendo caracteres de controle invisiveis
 * (zero-width, RTL override, etc - usados em ataques de phishing).
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/[​-‍⁠﻿]/g, "") // zero-width
    .replace(/[‪-‮⁦-⁩]/g, "") // RTL/LTR override
    .trim();
}

/**
 * Mascara um valor sensivel para logs (mostra so primeiros e ultimos chars).
 */
export function maskSensitive(value: string, visible = 4): string {
  if (value.length <= visible * 2) return "***";
  return `${value.slice(0, visible)}***${value.slice(-visible)}`;
}
