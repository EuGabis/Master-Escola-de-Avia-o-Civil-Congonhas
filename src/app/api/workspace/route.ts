import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ws = await db.workspace.findUnique({
    where: { id: session.wid },
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      plan: true,
      evolutionInstance: true,
      evolutionUrl: true,
      // Nao retornamos evolutionKey diretamente; so flag de configurada
      evolutionKey: true,
    },
  });
  if (!ws) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    workspace: {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      logo: ws.logo,
      plan: ws.plan,
      evolutionInstance: ws.evolutionInstance,
      evolutionUrl: ws.evolutionUrl,
      evolutionKeyMasked: ws.evolutionKey
        ? ws.evolutionKey.slice(0, 6) + "..." + ws.evolutionKey.slice(-4)
        : null,
      hasEvolutionKey: !!ws.evolutionKey,
    },
  });
}

// Limite generoso pra logo (PNG transparente pode ser maior que avatar)
const LOGO_MAX_LEN = 500_000;

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  evolutionInstance: z.string().max(120).optional(),
  evolutionUrl: z.string().url().or(z.literal("")).optional(),
  evolutionKey: z.string().max(200).optional(),
  logo: z
    .string()
    .max(LOGO_MAX_LEN, `Logo muito grande (max ${LOGO_MAX_LEN} bytes)`)
    .refine(
      (v) =>
        v === "" ||
        /^data:image\/(jpeg|png|webp|svg\+xml);base64,/.test(v) ||
        /^https?:\/\//.test(v),
      "Formato invalido (use png, jpeg, webp ou svg)"
    )
    .nullable()
    .optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // So owner/admin pode mexer nas configuracoes do workspace
  if (session.role !== "owner" && session.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch (err) {
    const zerr = err instanceof z.ZodError ? err.issues : null;
    return NextResponse.json(
      {
        error: "Dados invalidos",
        details: zerr?.map((i) => `${i.path.join(".")}: ${i.message}`) ?? null,
      },
      { status: 400 }
    );
  }

  // evolutionKey vazia significa "nao alterar" (manter)
  const data: Record<string, unknown> = { ...body };
  if (body.evolutionKey === "" || body.evolutionKey === undefined)
    delete data.evolutionKey;
  // logo vazia ("") vira null pra remover
  if (body.logo === "") data.logo = null;

  await db.workspace.update({ where: { id: session.wid }, data });
  return NextResponse.json({ ok: true });
}
