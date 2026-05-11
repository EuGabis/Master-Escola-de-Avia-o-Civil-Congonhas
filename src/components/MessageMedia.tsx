"use client";

import { Download, FileText, Play } from "lucide-react";
import { useState } from "react";

interface MediaProps {
  type: string;
  mediaBase64?: string | null;
  mediaUrl?: string | null;
  fileName?: string | null;
  content?: string;
  outgoing: boolean;
}

/**
 * Renderiza midia (imagem, video, audio, documento) dentro de uma bolha de mensagem.
 *
 * Suporta:
 *   - mediaBase64 (data URL completa) ou mediaUrl
 *   - image: thumbnail clicavel, abre lightbox
 *   - video: player com controls
 *   - audio: player com controls
 *   - document: card com nome + botao download
 */
export function MessageMedia({
  type,
  mediaBase64,
  mediaUrl,
  fileName,
  content,
  outgoing,
}: MediaProps) {
  const [lightbox, setLightbox] = useState(false);
  const src = mediaBase64 || mediaUrl;
  if (!src) {
    return <span className="italic opacity-70">[{type}]</span>;
  }

  if (type === "image") {
    return (
      <>
        <button
          onClick={() => setLightbox(true)}
          className="block max-w-xs rounded-lg overflow-hidden hover:opacity-90 transition"
        >
          <img src={src} alt={content ?? "imagem"} className="w-full h-auto" />
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
        {content && content !== "[video]" && content !== "[video]" && (
          <p className="text-sm mt-1 whitespace-pre-wrap">{content}</p>
        )}
      </div>
    );
  }

  if (type === "audio") {
    return (
      <audio src={src} controls className="max-w-xs" preload="metadata" />
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
    return <img src={src} alt="sticker" className="w-24 h-24" />;
  }

  // fallback
  return (
    <a href={src} download className="flex items-center gap-2 text-sm underline">
      <Play size={14} /> Baixar mídia
    </a>
  );
}
