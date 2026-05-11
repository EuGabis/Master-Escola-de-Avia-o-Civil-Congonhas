import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/kanban
 * Retorna todas as colunas + cards do workspace, com info da conversa relacionada.
 */
export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const columns = await db.kanbanColumn.findMany({
    where: { workspaceId: session.wid },
    orderBy: { order: "asc" },
    include: {
      cards: {
        orderBy: { order: "asc" },
        include: {
          conversation: {
            include: {
              contact: { select: { name: true, phone: true } },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ columns });
}
