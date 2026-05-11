import { cn } from "@/lib/cn";

/**
 * Logo da Master Escola de Aviação - recriado em SVG.
 * Cores e estilo seguem o site mastercongonhas.com.br
 */
export function Logo({
  className,
  variant = "navy",
  size = "md",
}: {
  className?: string;
  variant?: "navy" | "white" | "orange";
  size?: "sm" | "md" | "lg";
}) {
  const colors = {
    navy: "text-master-navy",
    white: "text-white",
    orange: "text-master-orange",
  }[variant];

  const sizes = {
    sm: { master: "text-lg", sub: "text-[8px]" },
    md: { master: "text-2xl", sub: "text-[10px]" },
    lg: { master: "text-4xl", sub: "text-xs" },
  }[size];

  return (
    <div className={cn("inline-flex flex-col leading-none", colors, className)}>
      <span className={cn("font-extrabold tracking-tight", sizes.master)}>
        MASTER
      </span>
      <span className={cn("font-semibold tracking-[0.2em] mt-0.5", sizes.sub)}>
        ESCOLA DE AVIAÇÃO
      </span>
    </div>
  );
}

/**
 * Ícone do avião — para favicon e adornos.
 */
export function PlaneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M21 16v-2l-8-5V3.5C13 2.67 12.33 2 11.5 2S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  );
}
