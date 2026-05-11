import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  wipLimit: z.number().int().positive().nullable().optional(),
  order: z.number().int().min(0).optional(),
});

async function ensureOwn(id: string, workspaceId: string) {
  return db.kanbanColumn.findFirst({
    where: { id, workspaceId },
    select: { id: true },
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
  if (!(await ensureOwn(id, session.wid)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }
  const col = await db.kanbanColumn.update({ where: { id }, data: body });
  return NextResponse.json({ column: col });
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

  await db.kanbanColumn.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
