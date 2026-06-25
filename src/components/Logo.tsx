import { cn } from "@/lib/cn";

/**
 * Logo oficial da Master Escola de Aviacao Civil Congonhas.
 *
 * Carrega o arquivo /logo-master.svg da pasta public — este eh o asset
 * oficial vetorizado a partir do PNG. Tem fundo navy proprio embutido,
 * entao funciona em qualquer cor de superficie.
 *
 * A prop `variant` e mantida por compat com callsites antigos mas nao
 * altera mais a aparencia (a logo oficial e colorida com paleta fixa).
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
  void variant; // mantido por compat, sem efeito visual

  const sizes = {
    sm: "h-8",
    md: "h-12",
    lg: "h-20",
  }[size];

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-master.svg"
      alt="Master Escola de Aviacao Civil Congonhas"
      className={cn(sizes, "w-auto select-none", className)}
      draggable={false}
    />
  );
}

/**
 * Versao compacta - so o sol com aviao (sem texto MASTER).
 * Usado em sidebar colapsada, favicon e PWA install.
 */
export function LogoMark({
  className,
  variant = "navy",
  size = "md",
}: {
  className?: string;
  /** Mantido por compat. O sol e sempre laranja; variant nao afeta. */
  variant?: "navy" | "white" | "orange";
  size?: "sm" | "md" | "lg";
}) {
  // variant atualmente nao e usado (sol e sempre laranja) mas mantemos
  // a prop pra nao quebrar callsites existentes.
  void variant;

  const sizes = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  }[size];

  const gradId = "master-sun-mark-grad";

  return (
    <svg
      viewBox="0 0 256 256"
      className={cn(sizes, className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Master Escola de Aviacao Civil Congonhas"
    >
      <defs>
        <radialGradient id={gradId} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#FFB066" />
          <stop offset="55%" stopColor="#F26522" />
          <stop offset="100%" stopColor="#C84810" />
        </radialGradient>
      </defs>
      <circle cx="128" cy="128" r="110" fill={`url(#${gradId})`} />
      <g
        transform="translate(128 128) rotate(-12) translate(-80 -25)"
        fill="#ffffff"
      >
        <path d="M 0 25 L 27 20 L 54 16 L 85 13 L 117 11 L 142 13 L 151 16 L 158 22 L 161 27 L 158 32 L 151 36 L 140 38 L 117 40 L 85 40 L 54 36 L 27 32 L 0 27 Z" />
        <path d="M 67 16 L 82 -9 L 92 -11 L 106 -7 L 99 14 Z" />
        <path d="M 130 13 L 142 -7 L 151 -7 L 148 11 Z" />
        <path d="M 142 20 L 161 11 L 168 11 L 166 20 Z" />
        <path d="M 142 31 L 161 40 L 168 40 L 166 31 Z" />
      </g>
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
