import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/conversations
 * Lista as conversas do workspace ordenadas por ultima atividade.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversations = await db.conversation.findMany({
    where: { workspaceId: session.wid },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      contact: { select: { id: true, name: true, phone: true, avatar: true } },
    },
  });

  return NextResponse.json({ conversations });
}
