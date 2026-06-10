/**
 * Gera um par de cores HSL deterministico a partir de uma string
 * (nome, email, etc) pra colorir avatares de forma unica e
 * reconhecivel. Mesmo input -> mesmas cores sempre.
 *
 * Estrategia: hash simples FNV-1a do input -> dois hues (h e h+30) ->
 * gradiente diagonal entre eles. Saturation e lightness fixos
 * resultam num espectro coeso que combina com o tema Master.
 */

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface AvatarGradient {
  /** Inline style pronto para passar ao <div style={...} />. */
  style: { background: string };
  /** Para CSS-in-JS / direct usage. */
  from: string;
  to: string;
}

/**
 * Recebe um nome (ou qualquer string identificadora) e retorna um
 * gradient diagonal coeso. Funciona em light e dark mode porque a
 * saturacao e lightness sao moderadas.
 */
export function avatarGradient(input: string): AvatarGradient {
  const seed = input.trim().toLowerCase() || "?";
  const h = hashString(seed) % 360;
  const h2 = (h + 35) % 360;
  const from = `hsl(${h}, 65%, 55%)`;
  const to = `hsl(${h2}, 70%, 45%)`;
  return {
    style: { background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` },
    from,
    to,
  };
}

/** So a inicial maiuscula pro avatar. */
export function avatarInitial(name: string): string {
  const t = name.trim();
  return t ? t.charAt(0).toUpperCase() : "?";
}
