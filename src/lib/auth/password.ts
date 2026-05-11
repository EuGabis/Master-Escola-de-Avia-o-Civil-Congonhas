import bcrypt from "bcryptjs";

/**
 * Hash de senha com bcrypt.
 * Rounds = 12 (~250ms por hash em CPU moderna).
 * Mais rounds = mais seguro contra brute force, mas pior UX no login.
 * 12 eh o sweet spot recomendado pela OWASP 2026.
 */
const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Politica de senha minima.
 * Aceita: 12+ chars, 1 minuscula, 1 maiuscula, 1 numero.
 * Nao exige caractere especial (estudos mostram que reduz UX sem ganho real).
 */
export function isPasswordStrong(pw: string): { ok: boolean; reason?: string } {
  if (pw.length < 12) return { ok: false, reason: "Minimo 12 caracteres" };
  if (!/[a-z]/.test(pw)) return { ok: false, reason: "Precisa de letra minuscula" };
  if (!/[A-Z]/.test(pw)) return { ok: false, reason: "Precisa de letra maiuscula" };
  if (!/[0-9]/.test(pw)) return { ok: false, reason: "Precisa de numero" };
  return { ok: true };
}
