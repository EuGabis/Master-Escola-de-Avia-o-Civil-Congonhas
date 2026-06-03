/**
 * Utilitarios de seguranca compartilhados.
 */

// MIME types aceitos em upload de midia.
// Cobre formatos comuns de smartphones modernos (HEIC/HEIF iPhone, AVIF Android,
// 3GP/AMR de gravacao de audio do whatsapp etc).
const ALLOWED_MIME = {
  image: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",  // iPhone fotos modernas
    "image/heif",
    "image/avif",
    "image/bmp",
    "image/tiff",
    "image/svg+xml",
  ],
  video: [
    "video/mp4",
    "video/webm",
    "video/quicktime",  // .mov iPhone
    "video/x-msvideo",  // .avi
    "video/3gpp",       // .3gp Android
    "video/3gpp2",
    "video/x-matroska", // .mkv
    "video/mpeg",
  ],
  audio: [
    "audio/mpeg",
    "audio/mp3",
    "audio/ogg",
    "audio/wav",
    "audio/wave",
    "audio/x-wav",
    "audio/webm",
    "audio/mp4",
    "audio/m4a",
    "audio/x-m4a",
    "audio/aac",
    "audio/3gpp",       // whatsapp voice notes
    "audio/3gpp2",
    "audio/amr",        // whatsapp voice notes (encoded)
    "audio/x-amr",
    "audio/opus",
  ],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.oasis.opendocument.text",
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/zip",
    "application/x-zip-compressed",
    "application/x-rar-compressed",
    "application/rtf",
    "text/plain",
    "text/csv",
    "text/html",
    "application/json",
    "application/xml",
    "text/xml",
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
