import { cn } from "@/lib/cn";

/**
 * Logo da Master Escola de Aviacao Civil Congonhas.
 *
 * Usa SVG inline com `currentColor` — adapta a cor pela classe `text-*`.
 *
 * Variants:
 *   - navy   = #1B2862 (em fundos claros)
 *   - white  = white   (em fundos escuros tipo sidebar)
 *   - orange = master-orange (decorativo)
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

  // Logo full (com texto MASTER + curva + circulo + aviao)
  const sizes = {
    sm: "h-7",
    md: "h-10",
    lg: "h-16",
  }[size];

  return (
    <div className={cn("inline-flex items-center", colors, className)}>
      <svg
        viewBox="0 0 880 240"
        className={cn(sizes, "w-auto")}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <text
          x="40"
          y="142"
          fontFamily="Inter, 'Arial Black', sans-serif"
          fontSize="120"
          fontWeight={900}
          fill="currentColor"
          letterSpacing="4"
        >
          MASTER
        </text>
        <circle
          cx="715"
          cy="118"
          r="100"
          stroke="currentColor"
          strokeWidth={6}
        />
        <g
          transform="translate(715 118) rotate(-28) translate(-55 -22)"
          fill="currentColor"
        >
          <path d="M 0 18 L 28 12 L 38 6 L 50 0 L 58 4 L 58 14 L 70 13 L 78 6 L 86 6 L 84 14 L 90 18 L 100 18 L 102 22 L 92 26 L 78 30 L 60 32 L 44 34 L 28 30 L 16 24 Z" />
          <path d="M 56 4 L 62 -8 L 66 -8 L 64 5 Z" />
          <path d="M 14 26 L 4 32 L 12 32 L 22 28 Z" />
        </g>
        <path
          d="M 38 215 Q 350 245 600 210 Q 720 195 810 130"
          stroke="currentColor"
          strokeWidth={6}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/**
 * Versao compacta - so o circulo com o aviao (sem texto MASTER).
 * Usado em sidebar colapsada, favicon e PWA install.
 */
export function LogoMark({
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
    sm: "w-7 h-7",
    md: "w-10 h-10",
    lg: "w-16 h-16",
  }[size];

  return (
    <svg
      viewBox="0 0 256 256"
      className={cn(sizes, colors, className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="128"
        cy="128"
        r="84"
        stroke="currentColor"
        strokeWidth={8}
      />
      <g
        transform="translate(128 128) rotate(-28) translate(-50 -20)"
        fill="currentColor"
      >
        <path d="M 0 16 L 26 11 L 36 5 L 48 0 L 56 4 L 56 13 L 66 12 L 74 5 L 80 5 L 78 13 L 84 16 L 92 16 L 94 20 L 84 24 L 70 28 L 54 30 L 40 32 L 26 28 L 14 22 Z" />
        <path d="M 54 4 L 60 -8 L 64 -8 L 62 5 Z" />
        <path d="M 12 24 L 2 30 L 10 30 L 20 26 Z" />
      </g>
      <path
        d="M 40 200 Q 128 230 216 168"
        stroke="currentColor"
        strokeWidth={6}
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Icone do aviao standalone (sem o circulo) - para adornos pequenos.
 */
export function PlaneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M21 16v-2l-8-5V3.5C13 2.67 12.33 2 11.5 2S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  );
}
