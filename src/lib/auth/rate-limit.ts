import { redis } from "@/lib/redis";

/**
 * Rate limiter sliding-window simples baseado em Redis.
 *
 * @param key - chave unica (ex: "login:email@x.com" ou "login:ip:1.2.3.4")
 * @param max - tentativas permitidas na janela
 * @param windowSec - janela em segundos
 * @returns ok=true se pode prosseguir; ok=false + retryAfter se bloqueado
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowSec: number
): Promise<{ ok: boolean; remaining: number; retryAfter?: number }> {
  const fullKey = `rl:${key}`;
  const count = await redis.incr(fullKey);
  if (count === 1) {
    await redis.expire(fullKey, windowSec);
  }
  if (count > max) {
    const ttl = await redis.ttl(fullKey);
    return { ok: false, remaining: 0, retryAfter: ttl > 0 ? ttl : windowSec };
  }
  return { ok: true, remaining: max - count };
}

export async function resetRateLimit(key: string) {
  await redis.del(`rl:${key}`);
}
