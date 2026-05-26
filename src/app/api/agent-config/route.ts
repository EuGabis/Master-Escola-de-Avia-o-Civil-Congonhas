import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DEFAULT_SYSTEM_PROMPT, invalidateAgentConfig } from "@/lib/ai";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  systemPrompt: z.string().max(32000).optional(),
  stopCommand: z.string().min(1).max(60).optional(),
  model: z.string().min(1).max(80).optional(),
  apiKey: z.string().max(200).optional(),
  tokenAlertThreshold: z.number().int().positive().nullable().optional(),
});

/**
 * GET /api/agent-config - retorna config do workspace (cria default se nao existir).
 * NUNCA retorna apiKey completa (mascarado).
 */
export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let cfg = await db.agentConfig.findUnique({
    where: { workspaceId: session.wid },
  });
  if (!cfg) {
    cfg = await db.agentConfig.create({
      data: {
        workspaceId: session.wid,
        enabled: false,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        stopCommand: "/humano",
        model: "gpt-4o-mini",
      },
    });
  }

  // Mascarar a apiKey
  const masked = cfg.apiKey
    ? cfg.apiKey.slice(0, 10) + "..." + cfg.apiKey.slice(-4)
    : null;

  return NextResponse.json({
    config: {
      enabled: cfg.enabled,
      systemPrompt: cfg.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      stopCommand: cfg.stopCommand,
      model: cfg.model,
      apiKeyMasked: masked,
      hasApiKey: !!cfg.apiKey,
      tokenAlertThreshold: cfg.tokenAlertThreshold,
      tokensUsedTotal: cfg.tokensUsedTotal,
      tokensUsedMonth: cfg.tokensUsedMonth,
      tokenMonthStart: cfg.tokenMonthStart,
      lastTokenUsage: cfg.lastTokenUsage,
      lastTokenUsageAt: cfg.lastTokenUsageAt,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch (err) {
    const zerr = err instanceof z.ZodError ? err.issues : null;
    console.error("[agent-config] PATCH validacao falhou:", zerr ?? err);
    return NextResponse.json(
      {
        error: "Dados invalidos",
        details: zerr?.map((i) => `${i.path.join(".")}: ${i.message}`) ?? null,
      },
      { status: 400 }
    );
  }

  try {
    // Garantir que existe
    await db.agentConfig.upsert({
      where: { workspaceId: session.wid },
      update: {},
      create: {
        workspaceId: session.wid,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
      },
    });

    // Se apiKey vier vazia (""), nao atualiza (preserva); se vier com valor, salva
    const data: Record<string, unknown> = { ...body };
    if (body.apiKey === "" || body.apiKey === undefined) delete data.apiKey;

    const updated = await db.agentConfig.update({
      where: { workspaceId: session.wid },
      data,
    });
    // Zera o cache em memoria pra mudanca refletir imediato (em vez de
    // esperar o TTL de 10s expirar).
    invalidateAgentConfig(session.wid);

    return NextResponse.json({
      ok: true,
      config: {
        enabled: updated.enabled,
        model: updated.model,
        systemPrompt: updated.systemPrompt,
      },
    });
  } catch (err) {
    console.error("[agent-config] PATCH db erro:", err);
    return NextResponse.json(
      {
        error: "Erro ao salvar no banco",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
