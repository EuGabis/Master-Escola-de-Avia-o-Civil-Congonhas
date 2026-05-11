import type { NextRequest } from "next/server";

/**
 * Extrai o IP real do client, considerando proxies (Railway/Cloudflare).
 * Prioriza headers de proxy, depois cai pra socket.
 */
export function getClientIp(req: NextRequest | Request): string {
  const headers = req.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    // pega o primeiro IP (cliente original); resto sao proxies intermediarios
    return forwarded.split(",")[0]!.trim();
  }
  return (
    headers.get("x-real-ip") ??
    headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

export function getUserAgent(req: NextRequest | Request): string {
  return req.headers.get("user-agent") ?? "unknown";
}
