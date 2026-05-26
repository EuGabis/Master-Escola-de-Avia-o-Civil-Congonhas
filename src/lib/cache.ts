/**
 * Cache em memoria simples com TTL.
 *
 * Vive no escopo do modulo, entao e local de cada lambda da Vercel
 * (nao e compartilhado entre instances). Util pra evitar reconsultar
 * dados que mudam pouco DENTRO de uma lambda warm — agentConfig,
 * workspace por instance Evolution, etc.
 *
 * Lambdas frias comecam com cache vazio (acceptable).
 * Em dev, sobrevive a hot reload via globalThis.
 */
type Entry<T> = { value: T; expiresAt: number };

const globalForCache = globalThis as unknown as {
  __memCache: Map<string, Entry<unknown>> | undefined;
};

const store: Map<string, Entry<unknown>> =
  globalForCache.__memCache ?? new Map();

if (process.env.NODE_ENV !== "production") {
  globalForCache.__memCache = store;
}

export async function memo<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > now) return hit.value;
  const value = await loader();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export function invalidate(key: string) {
  store.delete(key);
}

export function invalidatePrefix(prefix: string) {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
