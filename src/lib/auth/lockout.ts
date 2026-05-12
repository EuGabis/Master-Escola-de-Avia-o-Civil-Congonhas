import { redis } from "@/lib/redis";

/**
 * Account lockout - trava conta apos N falhas consecutivas.
 *
 * Diferente do rate limit (que eh por janela), o lockout persiste ate
 * uma das acoes:
 *   - reset de senha (limpa o counter)
 *   - login bem-sucedido (limpa)
 *   - tempo expirar (auto-unlock)
 *
 * Camadas defensivas:
 *   - rateLimit (login.ts): bloqueia ataques rapidos (5/15min)
 *   - lockout (este): bloqueia ataques distribuidos lentos (10/1h)
 */

const MAX_FAILURES = 10;
const LOCKOUT_SECONDS = 60 * 60; // 1 hora

const key = (email: string) => `lockout:${email.toLowerCase().trim()}`;

export async function isLocked(email: string): Promise<{
  locked: boolean;
  attempts: number;
  remainingSeconds: number;
}> {
  const k = key(email);
  const [count, ttl] = await Promise.all([
    redis.get<number>(k),
    redis.ttl(k),
  ]);
  const attempts = count ?? 0;
  return {
    locked: attempts >= MAX_FAILURES,
    attempts,
    remainingSeconds: ttl > 0 ? ttl : 0,
  };
}

export async function recordFailure(email: string): Promise<{
  locked: boolean;
  attempts: number;
}> {
  const k = key(email);
  const count = await redis.incr(k);
  if (count === 1) {
    await redis.expire(k, LOCKOUT_SECONDS);
  }
  return { locked: count >= MAX_FAILURES, attempts: count };
}

export async function clearLockout(email: string): Promise<void> {
  await redis.del(key(email));
}
