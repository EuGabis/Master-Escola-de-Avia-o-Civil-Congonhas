import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession, createSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ user: null }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.uid },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
      color: true,
      workspaceId: true,
      workspace: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}

// Limite generoso pra cobrir foto comprimida (256x256 jpeg quality 0.7
// fica em ~10-30kb, mas base64 inflada cabe folgada em 250kb).
const AVATAR_MAX_LEN = 250_000;

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  /**
   * Foto do agente em data URL (image/jpeg, image/png ou image/webp).
   * Limitado a 250kb pra nao inflar o JWT nem o payload das respostas
   * que carregam o avatar do usuario logado. Null remove a foto.
   */
  avatar: z
    .string()
    .max(AVATAR_MAX_LEN, `Imagem muito grande (max ${AVATAR_MAX_LEN} bytes)`)
    .refine(
      (v) =>
        v === "" ||
        /^data:image\/(jpeg|png|webp);base64,/.test(v) ||
        /^https?:\/\//.test(v),
      "Formato de imagem invalido (use jpeg, png ou webp)"
    )
    .nullable()
    .optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  // Normaliza avatar vazio pra null (remove)
  const data: Record<string, unknown> = { ...body };
  if (body.avatar === "") data.avatar = null;

  const updated = await db.user.update({
    where: { id: session.uid },
    data,
    select: { id: true, name: true, avatar: true, role: true, email: true },
  });

  // Se name ou avatar mudaram, re-emite cookie de sessao pra que o JWT
  // tenha os valores novos. Isso evita ter que relogar pra ver a foto
  // nova no proprio avatar (o JWT carrega name e avatar pra economizar
  // queries no layout do dashboard).
  if (body.name !== undefined || body.avatar !== undefined) {
    await createSession({
      uid: updated.id,
      wid: session.wid,
      role: updated.role,
      email: updated.email,
      name: updated.name,
      avatar: updated.avatar,
    });
  }

  return NextResponse.json({ ok: true, user: updated });
}
