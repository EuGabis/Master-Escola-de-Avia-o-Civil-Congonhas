import Redis from "ioredis";
import { env } from "./env";

/**
 * Singleton do cliente Redis (mesmo padrao do Prisma).
 * Usado para rate limit, cache e fila de jobs no futuro.
 */
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy(times) {
      // backoff exponencial limitado a 5s
      return Math.min(times * 200, 5000);
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

redis.on("error", (err) => {
  console.error("[redis] erro:", err.message);
});
