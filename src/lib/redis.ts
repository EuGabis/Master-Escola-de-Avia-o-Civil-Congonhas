import { Redis } from "@upstash/redis";
import { env } from "./env";

/**
 * Cliente Redis via Upstash REST API.
 *
 * Diferente do ioredis (TCP persistente), o Upstash usa HTTPS — funciona
 * perfeitamente em ambientes serverless (Vercel, Cloudflare Workers).
 *
 * Cada chamada eh uma request HTTP independente. Sem connection pool pra gerenciar.
 */
export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});
