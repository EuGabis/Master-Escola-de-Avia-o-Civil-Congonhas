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
      color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      iconBg: "bg-emerald-500 text-white",
    },
    error: {
      icon: X,
      color: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
      iconBg: "bg-red-500 text-white",
    },
    warning: {
      icon: AlertTriangle,
      color: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
      iconBg: "bg-amber-500 text-white",
    },
    info: {
      icon: Info,
      color: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
      iconBg: "bg-blue-500 text-white",
    },
  }[toast.type];

  const Icon = config.icon;

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 p-3 pr-8 rounded-xl border backdrop-blur-sm shadow-lg bg-white dark:bg-slate-900 animate-fade-in",
        config.color
      )}
      role="alert"
    >
      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", config.iconBg)}>
        <Icon size={14} strokeWidth={3} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">
          {toast.title}
        </div>
        {toast.description && (
          <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            {toast.description}
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        className="absolute top-2.5 right-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
      >
        <X size={14} />
      </button>
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
