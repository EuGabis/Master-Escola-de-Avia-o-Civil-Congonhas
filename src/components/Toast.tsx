"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Check, X, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  show: (toast: Omit<Toast, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const Ctx = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((t: Omit<Toast, "id">) => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { ...t, id }]);
    const duration = t.duration ?? 4000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, duration);
  }, []);

  const api: ToastContextValue = {
    show,
    success: (title, description) => show({ type: "success", title, description }),
    error: (title, description) => show({ type: "error", title, description, duration: 6000 }),
    warning: (title, description) => show({ type: "warning", title, description }),
    info: (title, description) => show({ type: "info", title, description }),
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm">
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            toast={t}
            onClose={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
          />
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Fallback to alert se ToastProvider nao montado (nao deveria acontecer)
    return {
      show: (t: { title: string; description?: string }) => alert(t.title),
      success: (t: string) => console.log("[toast]", t),
      error: (t: string) => alert(t),
      warning: (t: string) => console.warn("[toast]", t),
      info: (t: string) => console.log("[toast]", t),
    } as ToastContextValue;
  }
  return ctx;
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const config = {
    success: {
      icon: Check,
      ring: "ring-emerald-500/20",
      iconBg: "bg-emerald-500 text-white",
      bar: "bg-emerald-500",
    },
    error: {
      icon: X,
      ring: "ring-red-500/20",
      iconBg: "bg-red-500 text-white",
      bar: "bg-red-500",
    },
    warning: {
      icon: AlertTriangle,
      ring: "ring-amber-500/20",
      iconBg: "bg-amber-500 text-white",
      bar: "bg-amber-500",
    },
    info: {
      icon: Info,
      ring: "ring-blue-500/20",
      iconBg: "bg-blue-500 text-white",
      bar: "bg-blue-500",
    },
  }[toast.type];

  const Icon = config.icon;
  const duration = toast.duration ?? 4000;

  return (
    <div
      className={cn(
        "pointer-events-auto relative flex items-start gap-3 p-3.5 pr-9 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900 animate-slide-in ring-2 overflow-hidden",
        config.ring
      )}
      role="alert"
    >
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
          config.iconBg
        )}
      >
        <Icon size={15} strokeWidth={3} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
          {toast.title}
        </div>
        {toast.description && (
          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-snug">
            {toast.description}
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        className="absolute top-2.5 right-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition rounded p-0.5"
        aria-label="Fechar"
      >
        <X size={14} />
      </button>
      {/* Barra de progresso do auto-dismiss */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute bottom-0 left-0 h-[2px] w-full origin-left",
          config.bar
        )}
        style={{
          animation: `toast-progress ${duration}ms linear forwards`,
        }}
      />
    </div>
  );
}

/**
 * Hook para confirmacao (substitui window.confirm).
 * Retorna Promise<boolean>.
 */
interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary";
}

const ConfirmCtx = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<((v: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setOpts(options);
      setResolver(() => resolve);
    });
  }, []);

  const handle = (value: boolean) => {
    resolver?.(value);
    setOpts(null);
    setResolver(null);
  };

  useEffect(() => {
    if (!opts) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handle(false);
      if (e.key === "Enter") handle(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts]);

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {opts && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => handle(false)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-5">
            <h3 className="font-semibold text-slate-900 dark:text-white">{opts.title}</h3>
            {opts.description && (
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{opts.description}</p>
            )}
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => handle(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
              >
                {opts.cancelText ?? "Cancelar"}
              </button>
              <button
                onClick={() => handle(true)}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition text-white shadow-sm",
                  opts.variant === "danger"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-master-orange hover:bg-master-orange-600"
                )}
                autoFocus
              >
                {opts.confirmText ?? "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) {
    return async (opts: ConfirmOptions) => window.confirm(opts.title);
  }
  return ctx;
}
