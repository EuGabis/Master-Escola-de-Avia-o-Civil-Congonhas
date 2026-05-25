import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

/**
 * Health check com timings — pra diagnosticar lentidao.
 * Mede separadamente: db, redis e total.
 */
export async function GET() {
  const t0 = Date.now();
  const checks: {
    db: boolean;
    redis: boolean;
    dbMs: number;
    redisMs: number;
    totalMs: number;
    region: string | null;
  } = {
    db: false,
    redis: false,
    dbMs: 0,
    redisMs: 0,
    totalMs: 0,
    region: process.env.VERCEL_REGION ?? null,
  };

  const tDb = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    checks.db = true;
  } catch (e) {
    console.error("[health] db erro:", e);
  }
  checks.dbMs = Date.now() - tDb;

  const tRedis = Date.now();
  try {
    const key = `health:${Date.now()}`;
    await redis.set(key, "ok", { ex: 10 });
    checks.redis = (await redis.get(key)) === "ok";
  } catch (e) {
    console.error("[health] redis erro:", e);
  }
  checks.redisMs = Date.now() - tRedis;

  checks.totalMs = Date.now() - t0;

  const ok = checks.db && checks.redis;
  return NextResponse.json(
    { ok, checks, timestamp: new Date().toISOString() },
    { status: ok ? 200 : 503 }
  );
}
