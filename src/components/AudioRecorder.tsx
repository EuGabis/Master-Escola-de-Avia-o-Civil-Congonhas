"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type RecorderState = "idle" | "recording" | "sending";

interface Props {
  /** Chamado com o File pronto pra enviar (audio/webm ou audio/ogg). */
  onSend: (file: File) => Promise<void> | void;
  /** Desabilita o botao enquanto outra acao roda (envio, upload, etc). */
  disabled?: boolean;
  /** Notifica o pai sobre mudancas de estado pra que ele esconda
   *  outros controles (input de texto, send) durante a gravacao. */
  onStateChange?: (state: RecorderState) => void;
}

/**
 * Botao de microfone com gravacao via MediaRecorder. Quando o usuario
 * clica, abre permissao do navegador, comeca a gravar e mostra um painel
 * com cronometro + dois botoes (apagar | enviar). O blob gravado e
 * embrulhado num File e entregue via onSend pra reaproveitar o fluxo de
 * upload de midia existente.
 *
 * Limites: 5 minutos max (corta automatico). Formato: webm/opus quando
 * suportado, senao mp4 ou ogg como fallback.
 */
export function AudioRecorder({ onSend, disabled, onStateChange }: Props) {
  const [state, setStateInternal] = useState<RecorderState>("idle");
  const setState = (s: RecorderState) => {
    setStateInternal(s);
    onStateChange?.(s);
  };
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const tickInterval = useRef<NodeJS.Timeout | null>(null);

  // Limpa stream/timer se o componente desmontar no meio
  useEffect(() => {
    return () => {
      if (tickInterval.current) clearInterval(tickInterval.current);
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function pickMime(): string {
    const opts = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ];
    for (const o of opts) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(o))
        return o;
    }
    return "audio/webm";
  }

  async function start() {
    setError(null);
    if (disabled) return;
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("Gravação não suportada nesse navegador");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const mime = pickMime();
      const rec = new MediaRecorder(s, { mimeType: mime });
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.start();
      mediaRecorder.current = rec;
      setState("recording");
      setSeconds(0);
      tickInterval.current = setInterval(() => {
        setSeconds((s) => {
          // Auto-stop em 5 minutos
          if (s + 1 >= 300) {
            void stopAndSend();
            return s;
          }
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        msg.includes("Permission") || msg.includes("denied")
          ? "Microfone bloqueado. Permita o acesso nas configurações do navegador."
          : msg
      );
      cleanup();
    }
  }

  function cleanup() {
    if (tickInterval.current) {
      clearInterval(tickInterval.current);
      tickInterval.current = null;
    }
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    mediaRecorder.current = null;
    chunks.current = [];
  }

  function cancel() {
    if (mediaRecorder.current?.state === "recording") {
      mediaRecorder.current.stop();
    }
    cleanup();
    setState("idle");
    setSeconds(0);
  }

  async function stopAndSend() {
    const rec = mediaRecorder.current;
    if (!rec) {
      setState("idle");
      return;
    }
    // Aguarda o ondataavailable final disparar antes de processar
    const blobPromise = new Promise<Blob>((resolve) => {
      rec.onstop = () => {
        const type = rec.mimeType || "audio/webm";
        resolve(new Blob(chunks.current, { type }));
      };
    });
    if (rec.state === "recording") rec.stop();
    cleanup();
    setState("sending");

    try {
      const blob = await blobPromise;
      if (blob.size === 0) {
        setError("Gravação vazia");
        setState("idle");
        return;
      }
      const ext = blob.type.includes("ogg")
        ? "ogg"
        : blob.type.includes("mp4")
          ? "m4a"
          : "webm";
      const file = new File([blob], `audio-${Date.now()}.${ext}`, {
        type: blob.type,
      });
      await onSend(file);
      setState("idle");
      setSeconds(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar");
      setState("idle");
    }
  }

  // ====== UI ======

  if (state === "idle") {
    return (
      <div className="flex flex-col items-end">
        <button
          type="button"
          onClick={start}
          disabled={disabled}
          className="p-2 md:p-2.5 rounded-full text-slate-500 hover:text-master-orange hover:bg-master-orange/10 transition disabled:opacity-50"
          title="Gravar áudio"
          aria-label="Gravar áudio"
        >
          <Mic size={18} />
        </button>
        {error && (
          <span className="text-[10px] text-red-500 max-w-[160px] text-right mt-0.5">
            {error}
          </span>
        )}
      </div>
    );
  }

  // Gravando ou enviando: ocupa todo o espaco do input com os controles
  return (
    <div className="flex-1 flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-pill px-3 py-1.5">
      <button
        type="button"
        onClick={cancel}
        disabled={state === "sending"}
        className="p-1.5 rounded-full text-red-500 hover:bg-red-500/15 transition disabled:opacity-50"
        title="Cancelar"
        aria-label="Cancelar gravação"
      >
        <Trash2 size={16} />
      </button>

      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span
          className={cn(
            "w-2.5 h-2.5 rounded-full bg-red-500 shrink-0",
            state === "recording" && "animate-pulse"
          )}
        />
        <span className="text-sm font-semibold text-red-600 dark:text-red-400 tabular-nums">
          {formatTime(seconds)}
        </span>
        <span className="text-xs text-slate-500 hidden sm:inline">
          {state === "recording" ? "Gravando..." : "Enviando..."}
        </span>
      </div>

      <button
        type="button"
        onClick={stopAndSend}
        disabled={state === "sending"}
        className="p-2 rounded-full bg-master-orange hover:bg-master-orange-600 text-white shadow-sm transition disabled:opacity-50 active:scale-95"
        title="Enviar áudio"
        aria-label="Enviar áudio"
      >
        {state === "sending" ? (
          <Loader2 size={16} className="animate-spin" />
        ) : state === "recording" ? (
          <Square size={14} className="fill-current" />
        ) : (
          <Send size={14} />
        )}
      </button>
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${ss.toString().padStart(2, "0")}`;
}
