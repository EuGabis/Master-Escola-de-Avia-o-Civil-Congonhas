import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

const addSchema = z.object({ labelId: z.string().min(1) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const conv = await db.conversation.findFirst({
    where: { id, workspaceId: session.wid },
    select: { id: true },
  });
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: z.infer<typeof addSchema>;
  try {
    body = addSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }

  const label = await db.label.findFirst({
    where: { id: body.labelId, workspaceId: session.wid },
    select: { id: true },
  });
  if (!label)
    return NextResponse.json({ error: "Etiqueta invalida" }, { status: 400 });

  await db.conversationLabel
    .create({
      data: { conversationId: id, labelId: body.labelId },
    })
    .catch(() => null); // ignora duplicate

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const labelId = new URL(req.url).searchParams.get("labelId");
  if (!labelId)
    return NextResponse.json({ error: "labelId requerido" }, { status: 400 });

  await db.conversationLabel
    .delete({ where: { conversationId_labelId: { conversationId: id, labelId } } })
    .catch(() => null);

  return NextResponse.json({ ok: true });
}
