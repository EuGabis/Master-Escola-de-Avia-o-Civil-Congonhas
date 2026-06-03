"use client";

import { Download, FileText, Play, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface MediaProps {
  type: string;
  mediaBase64?: string | null;
  mediaUrl?: string | null;
  fileName?: string | null;
  content?: string;
  outgoing: boolean;
  /** ID da mensagem - usado para lazy-load da midia via /api/messages/[id]/media */
  messageId?: string;
  /** Flag vinda do API indicando que a mensagem TEM midia (mas nao foi enviada inline) */
  hasMedia?: boolean;
}

/**
 * Renderiza midia (imagem, video, audio, documento) dentro de uma bolha de mensagem.
 *
 * Otimizacao:
 *   - Se receber mediaBase64 inline, renderiza direto (compat retro)
 *   - Se receber so messageId + hasMedia, faz fetch lazy no /api/messages/[id]/media
 *   - Reduz drasticamente o payload do /messages endpoint quando ha midias grandes
 */
export function MessageMedia({
  type,
  mediaBase64,
  mediaUrl,
  fileName,
  content,
  outgoing,
  messageId,
  hasMedia,
}: MediaProps) {
  const [lightbox, setLightbox] = useState(false);
  const [lazySrc, setLazySrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Se temos mediaBase64 ou mediaUrl inline, usa direto
  const inlineSrc = mediaBase64 || mediaUrl;
  const src = inlineSrc || lazySrc;
  const needsFetch = !inlineSrc && hasMedia && messageId;

  // Lazy-load: busca a midia quando precisar
  useEffect(() => {
    if (!needsFetch || lazySrc || loading) return;
    setLoading(true);
    fetch(`/api/messages/${messageId}/media`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { mediaBase64?: string; mediaUrl?: string }) => {
        setLazySrc(data.mediaBase64 || data.mediaUrl || null);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [needsFetch, messageId, lazySrc, loading]);

  // Estado: sem fonte E não tem hasMedia -> placeholder vazio
  if (!src && !needsFetch) {
    return <span className="italic opacity-70">[{type}]</span>;
  }

  // Estado: carregando midia
  if (loading || (needsFetch && !lazySrc && !error)) {
    return (
      <div className="flex items-center gap-2 text-xs opacity-70 py-2">
        <Loader2 size={14} className="animate-spin" />
        Carregando {type === "image" ? "imagem" : type === "audio" ? "áudio" : type === "video" ? "vídeo" : "mídia"}...
      </div>
    );
  }

  // Estado: erro de carregamento
  if (error || !src) {
    return (
      <span className="italic opacity-70 text-xs">
        ⚠ Não foi possível carregar a mídia
      </span>
    );
  }

  if (type === "image") {
    return (
      <>
        <button
          onClick={() => setLightbox(true)}
          className="block max-w-xs rounded-lg overflow-hidden hover:opacity-90 transition"
        >
          <img
            src={src}
            alt={content ?? "imagem"}
            className="w-full h-auto"
            loading="lazy"
          />
        </button>
        {content && content !== "[image]" && content !== "[imagem]" && (
          <p className="text-sm mt-1 whitespace-pre-wrap">{content}</p>
        )}
        {lightbox && (
          <div
            onClick={() => setLightbox(false)}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-zoom-out"
          >
            <img
              src={src}
              alt={content ?? "imagem"}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </>
    );
  }

  if (type === "video") {
    return (
      <div className="max-w-xs">
        <video
          src={src}
          controls
          className="w-full rounded-lg"
          preload="metadata"
        />
        {content && content !== "[video]" && (
          <p className="text-sm mt-1 whitespace-pre-wrap">{content}</p>
        )}
      </div>
    );
  }

  if (type === "audio") {
    const hasTranscript = content && content !== "[audio]";
    return (
      <div className="max-w-xs">
        <audio src={src} controls className="w-full" preload="metadata" />
        {hasTranscript && (
          <p className="text-sm mt-1 whitespace-pre-wrap opacity-90">
            🎤 {content}
          </p>
        )}
      </div>
    );
  }

  if (type === "document") {
    return (
      <a
        href={src}
        download={fileName || "arquivo"}
        className={`flex items-center gap-3 p-3 rounded-lg ${
          outgoing
            ? "bg-master-orange-700/40 hover:bg-master-orange-700/60"
            : "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
        } transition`}
      >
        <FileText size={20} className="shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">
            {fileName || "Documento"}
          </div>
          <div className="text-xs opacity-70">Clique para baixar</div>
        </div>
        <Download size={14} className="opacity-70 shrink-0" />
      </a>
    );
  }

  if (type === "sticker") {
    return <img src={src} alt="sticker" className="w-24 h-24" loading="lazy" />;
  }

  return (
    <a href={src} download className="flex items-center gap-2 text-sm underline">
      <Play size={14} /> Baixar mídia
    </a>
  );
}
