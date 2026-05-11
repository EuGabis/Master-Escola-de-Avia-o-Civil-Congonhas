import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

const patchSchema = z.object({
  columnId: z.string().min(1).optional(),
  order: z.number().int().min(0).optional(),
  title: z.string().min(1).max(120).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

async function ensureOwn(cardId: string, workspaceId: string) {
  return db.kanbanCard.findFirst({
    where: { id: cardId, column: { workspaceId } },
    select: { id: true, columnId: true, order: true },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await ensureOwn(id, session.wid);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }

  // Se mudou de coluna, valida que a nova coluna pertence ao workspace
  if (body.columnId && body.columnId !== existing.columnId) {
    const col = await db.kanbanColumn.findFirst({
      where: { id: body.columnId, workspaceId: session.wid },
      select: { id: true },
    });
    if (!col)
      return NextResponse.json({ error: "Coluna invalida" }, { status: 400 });
  }

  const card = await db.kanbanCard.update({ where: { id }, data: body });
  return NextResponse.json({ card });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await ensureOwn(id, session.wid)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.kanbanCard.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
