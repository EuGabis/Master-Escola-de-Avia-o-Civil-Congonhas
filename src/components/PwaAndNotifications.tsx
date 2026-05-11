"use client";

import { useEffect, useState } from "react";
import { getPusherClient } from "@/lib/pusher-client";
import { Bell, BellOff, X } from "lucide-react";

/**
 * Componente client-side global que faz:
 *   1. Registra service worker (PWA install + offline cache)
 *   2. Pede permissao de notificacao desktop
 *   3. Mostra notification quando msg nova chega via Pusher
 *   4. Indica status offline visualmente
 *
 * Renderiza um banner discreto no canto inferior quando precisa permissao.
 */

interface PwaProps {
  workspaceId: string;
}

export function PwaAndNotifications({ workspaceId }: PwaProps) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [showPrompt, setShowPrompt] = useState(false);
  const [online, setOnline] = useState(true);

  // Registra service worker
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.warn("[sw] falha registrar:", err));
    }
  }, []);

  // Online/offline status
  useEffect(() => {
    if (typeof window === "undefined") return;
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Detecta status atual da permissao + mostra banner se "default"
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
    if (Notification.permission === "default") {
      // Mostra prompt apos 3 segundos (nao logo de cara)
      const t = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(t);
    }
  }, []);

  // Inscreve no canal do workspace pra disparar notificacoes
  useEffect(() => {
    if (permission !== "granted") return;
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`private-workspace-${workspaceId}`);

    channel.bind(
      "message:new",
      (payload: {
        conversationId?: string;
        direction?: string;
        content?: string;
        source?: string;
      }) => {
        // So notifica mensagens recebidas (in), nao nossas respostas
        if (payload.direction !== "in") return;

        // Se a tab estiver focada, nao spam-notifica
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          return;
        }

        try {
          const notification = new Notification("Nova mensagem", {
            body: payload.content ?? "Voce recebeu uma nova mensagem",
            icon: "/icon.svg",
            badge: "/icon.svg",
            tag: payload.conversationId,
            requireInteraction: false,
          });
          notification.onclick = () => {
            window.focus();
            if (payload.conversationId) {
              window.location.href = `/conversations?id=${payload.conversationId}`;
            }
            notification.close();
          };
        } catch {
          // Safari iOS / outros que bloqueiam podem dar throw
        }
      }
    );

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`private-workspace-${workspaceId}`);
    };
  }, [permission, workspaceId]);

  async function requestPermission() {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    setShowPrompt(false);
  }

  return (
    <>
      {/* Indicador offline */}
      {!online && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-xs font-medium py-1.5 text-center shadow-lg">
          📡 Voce esta offline. Algumas funcoes podem nao funcionar.
        </div>
      )}

      {/* Prompt de notificacao */}
      {showPrompt && permission === "default" && (
        <div className="fixed bottom-6 right-6 z-40 max-w-sm bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 animate-fade-in">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-lg bg-master-orange/10 text-master-orange flex items-center justify-center shrink-0">
              <Bell size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                Ativar notificacoes?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Seja notificado de novas mensagens mesmo com a aba minimizada.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={requestPermission}
                  className="text-xs font-medium bg-master-orange hover:bg-master-orange-600 text-white px-3 py-1.5 rounded-lg transition"
                >
                  Ativar
                </button>
                <button
                  onClick={() => setShowPrompt(false)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2 py-1.5 rounded-lg transition"
                >
                  Agora nao
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowPrompt(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Botao pequeno na sidebar/header para reabrir o prompt manualmente.
 */
export function NotificationToggle() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  async function request() {
    if (permission === "unsupported") return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  if (permission === "unsupported") return null;

  return (
    <button
      onClick={request}
      title={
        permission === "granted"
          ? "Notificacoes ativadas"
          : "Ativar notificacoes"
      }
      className="text-slate-300 hover:text-white p-1.5 rounded-lg transition"
    >
      {permission === "granted" ? <Bell size={16} /> : <BellOff size={16} />}
    </button>
  );
}
