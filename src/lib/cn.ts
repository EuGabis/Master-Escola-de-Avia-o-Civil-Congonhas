/**
 * Pequeno helper para concatenar classes condicionalmente.
 * Evita dependencia extra (clsx/twMerge) por enquanto.
 */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
