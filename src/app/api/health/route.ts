import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";

/**
 * Health check usado por UptimeRobot/Railway healthcheck.
 * Verifica banco + redis.
 */
export async function GET() {
  const checks = { db: false, redis: false };
  try {
    await db.$queryRaw`SELECT 1`;
    checks.db = true;
  } catch {}
  try {
    const key = `health:${Date.now()}`;
    await redis.set(key, "ok", { ex: 10 });
    checks.redis = (await redis.get(key)) === "ok";
  } catch {}

  const ok = checks.db && checks.redis;
  return NextResponse.json(
    { ok, checks, timestamp: new Date().toISOString() },
    { status: ok ? 200 : 503 }
  );
}
