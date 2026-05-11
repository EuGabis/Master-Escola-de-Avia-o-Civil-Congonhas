import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

const createSchema = z.object({
  columnId: z.string().min(1),
  conversationId: z.string().min(1).optional(),
  title: z.string().min(1).max(120),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }

  // Valida coluna e conversa do mesmo workspace
  const column = await db.kanbanColumn.findFirst({
    where: { id: body.columnId, workspaceId: session.wid },
    select: { id: true },
  });
  if (!column)
    return NextResponse.json({ error: "Coluna invalida" }, { status: 400 });

  if (body.conversationId) {
    const conv = await db.conversation.findFirst({
      where: { id: body.conversationId, workspaceId: session.wid },
      select: { id: true },
    });
    if (!conv)
      return NextResponse.json({ error: "Conversa invalida" }, { status: 400 });

    // Conversa ja tem card? Evita duplicar (1-1 via @unique)
    const existing = await db.kanbanCard.findUnique({
      where: { conversationId: body.conversationId },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Conversa ja esta no Kanban" },
        { status: 409 }
      );
    }
  }

  const last = await db.kanbanCard.findFirst({
    where: { columnId: body.columnId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const card = await db.kanbanCard.create({
    data: {
      columnId: body.columnId,
      conversationId: body.conversationId,
      title: body.title,
      notes: body.notes,
      order: (last?.order ?? -1) + 1,
    },
  });

  return NextResponse.json({ card });
}
