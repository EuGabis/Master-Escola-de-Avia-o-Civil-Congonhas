"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || typeof window === "undefined") return null;

  const sizeClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
  }[size];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <div
        ref={ref}
        className={cn(
          "relative bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-h-[90vh] flex flex-col overflow-hidden",
          // Mobile: bottom sheet com cantos arredondados no topo
          "rounded-t-2xl sm:rounded-2xl",
          sizeClass
        )}
      >
        <header className="flex items-start justify-between gap-4 p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base">
              {title}
            </h2>
            {description && (
              <p className="text-xs text-slate-500 mt-0.5">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition shrink-0"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </header>
        <div className="p-4 sm:p-5 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <footer className="px-4 sm:px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0 flex-wrap">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}

export function Button({
  children,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const variants = {
    primary:
      "bg-master-orange hover:bg-master-orange-600 text-white shadow-sm shadow-master-orange/20",
    secondary:
      "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white",
    danger: "bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-600/20",
    ghost:
      "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300",
  };
  return (
    <button
      {...props}
      className={cn(
        "rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100",
        variants[variant],
        props.className
      )}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-master-orange focus:border-transparent",
        props.className
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-master-orange focus:border-transparent resize-none",
        props.className
      )}
    />
  );
}

export function Label({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...props}
      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider"
    >
      {children}
    </label>
  );
}
