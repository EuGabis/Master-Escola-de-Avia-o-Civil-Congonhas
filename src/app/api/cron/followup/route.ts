import { NextResponse, type NextRequest } from "next/server";
import { processFollowUps } from "@/lib/followup";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // seconds

/**
 * GET /api/cron/followup
 * Executa o batch de Follow-ups.
 *
 * Acionado por:
 *   - Vercel Cron (header `x-vercel-cron: 1`)
 *   - Manualmente (header `Authorization: Bearer <WEBHOOK_SECRET>`)
 *
 * Retorna { totalSent, errors }.
 */
export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const auth = req.headers.get("authorization");
  const tokenValid = auth === `Bearer ${env.WEBHOOK_SECRET}`;

  if (!isVercelCron && !tokenValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processFollowUps();
  return NextResponse.json({
    ok: true,
    ...result,
    timestamp: new Date().toISOString(),
  });
}
