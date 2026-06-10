import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/reset-bad-names
 *
 * Limpa o `name` de contatos cujo nome foi contaminado pelo bug antigo
 * do webhook (Evolution mandava pushName do whatsapp da escola em
 * mensagens fromMe, e o handler antigo sobrescrevia). Esses contatos
 * acabaram todos com nome "Master | Escola de Aviacao Civil Congonhas"
 * ou similar.
 *
 * Resetamos o nome desses contatos pro telefone — quando eles
 * responderem uma mensagem, o webhook (ja corrigido) vai gravar o
 * pushName real.
 *
 * Body opcional: { patterns: string[] } pra customizar os termos
 * considerados "contaminacao". Default cobre o bug observado.
 */
const bodySchema = z.object({
  patterns: z.array(z.string().min(2).max(120)).optional(),
});

const DEFAULT_PATTERNS = [
  "master | escola de avia",
  "master|escola de avia",
  "escola de aviacao civil",
  "escola de aviação civil",
];

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "owner" && session.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: z.infer<typeof bodySchema> = {};
  try {
    body = bodySchema.parse(await req.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }
  const patterns = (body.patterns?.length ? body.patterns : DEFAULT_PATTERNS).map(
    (p) => p.toLowerCase()
  );

  // Carrega so id/name/phone — comparacao do pattern em memoria (mais
  // simples que OR de ILIKEs no SQL).
  const candidates = await db.contact.findMany({
    where: { workspaceId: session.wid },
    select: { id: true, name: true, phone: true },
  });

  const matched = candidates.filter((c) => {
    const lower = c.name.toLowerCase();
    return patterns.some((p) => lower.includes(p));
  });

  let updated = 0;
  for (const c of matched) {
    if (c.name === c.phone) continue;
    await db.contact.update({
      where: { id: c.id },
      data: { name: c.phone },
    });
    updated++;
  }

  return NextResponse.json({
    ok: true,
    summary: {
      totalContatos: candidates.length,
      detectados: matched.length,
      resetados: updated,
      padroes: patterns,
    },
  });
}
