import { cn } from "@/lib/cn";

/**
 * Logo oficial da Master Escola de Aviacao Civil Congonhas.
 *
 * Reproducao em SVG do logo oficial — texto MASTER, swoosh curvado e
 * sol laranja com aviao branco.
 *
 * Variants controlam APENAS o texto + swoosh (currentColor):
 *   - navy   = #1B2862 (em fundos claros)
 *   - white  = white   (em fundos escuros tipo sidebar)
 *   - orange = master-orange (decorativo)
 *
 * O sol laranja e o aviao tem cores FIXAS (sol = gradient laranja Master,
 * aviao = branco) — preservam a identidade visual em qualquer fundo.
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
    sm: "h-8",
    md: "h-12",
    lg: "h-20",
  }[size];

  // ID unico por instancia evita conflito de gradient quando varias
  // Logos coexistem na mesma pagina (sidebar + login splash, etc).
  const gradId = "master-sun-grad";

  return (
    <div className={cn("inline-flex items-center", colors, className)}>
      <svg
        viewBox="0 0 880 280"
        className={cn(sizes, "w-auto")}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Master Escola de Aviacao Civil Congonhas"
      >
        <defs>
          {/* Gradiente radial do sol — claro no centro, escuro nas bordas */}
          <radialGradient id={gradId} cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#FFB066" />
            <stop offset="55%" stopColor="#F26522" />
            <stop offset="100%" stopColor="#C84810" />
          </radialGradient>
        </defs>

        {/* TEXTO MASTER — letras heavy, ligeiramente compactas */}
        <text
          x="20"
          y="160"
          fontFamily="'Helvetica Neue', Inter, 'Arial Black', sans-serif"
          fontSize="150"
          fontWeight={900}
          fill="currentColor"
          letterSpacing="-2"
          fontStyle="normal"
        >
          MASTER
        </text>

        {/* SOL — circulo laranja com gradiente */}
        <circle cx="725" cy="130" r="115" fill={`url(#${gradId})`} />

        {/* AVIAO BRANCO sobre o sol — desenho simplificado de aeronave
            comercial em vista lateral, inclinado pra cima e direita */}
        <g
          transform="translate(725 130) rotate(-12) translate(-90 -28)"
          fill="#ffffff"
        >
          {/* Fuselagem principal + nariz pontudo */}
          <path d="M 0 28 L 30 22 L 60 18 L 95 14 L 130 12 L 158 14 L 168 18 L 175 24 L 178 30 L 175 36 L 168 40 L 156 42 L 130 44 L 95 44 L 60 40 L 30 36 L 0 30 Z" />
          {/* Asa principal (lado superior) */}
          <path d="M 75 18 L 92 -10 L 102 -12 L 118 -8 L 110 16 Z" />
          {/* Asa de cauda (vertical) */}
          <path d="M 145 14 L 158 -8 L 168 -8 L 165 12 Z" />
          {/* Estabilizador horizontal traseiro */}
          <path d="M 158 22 L 178 12 L 186 12 L 184 22 Z" />
          <path d="M 158 34 L 178 44 L 186 44 L 184 34 Z" />
          {/* Rastro/vento curto atras pra sensacao de movimento */}
          <rect x="-12" y="26" width="14" height="3" rx="1.5" opacity="0.55" />
          <rect x="-22" y="30" width="20" height="2" rx="1" opacity="0.35" />
        </g>

        {/* SWOOSH — curva curvada passando por baixo do texto ate o sol */}
        <path
          d="M 28 235 Q 200 270 380 248 T 600 218 Q 680 200 740 175"
          stroke="currentColor"
          strokeWidth={7}
          strokeLinecap="round"
        />
      </svg>
    </div>
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
