import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ws = session.wid;

  const now = new Date();
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // KPIs
  const [
    totalConversations,
    openConversations,
    resolvedConversations,
    pendingConversations,
    totalContacts,
    contacts30d,
    totalMessages,
    messages30d,
    msgsIn30d,
    msgsOut30d,
  ] = await Promise.all([
    db.conversation.count({ where: { workspaceId: ws } }),
    db.conversation.count({ where: { workspaceId: ws, status: "open" } }),
    db.conversation.count({ where: { workspaceId: ws, status: "resolved" } }),
    db.conversation.count({ where: { workspaceId: ws, status: "pending" } }),
    db.contact.count({ where: { workspaceId: ws } }),
    db.contact.count({ where: { workspaceId: ws, createdAt: { gte: since30d } } }),
    db.message.count({ where: { conversation: { workspaceId: ws } } }),
    db.message.count({
      where: { conversation: { workspaceId: ws }, timestamp: { gte: since30d } },
    }),
    db.message.count({
      where: {
        conversation: { workspaceId: ws },
        direction: "in",
        timestamp: { gte: since30d },
      },
    }),
    db.message.count({
      where: {
        conversation: { workspaceId: ws },
        direction: "out",
        timestamp: { gte: since30d },
      },
    }),
  ]);

  // Mensagens por dia (30 dias)
  const msgsByDay: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(now.getDate() - i);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    const c = await db.message.count({
      where: {
        conversation: { workspaceId: ws },
        timestamp: { gte: start, lte: end },
      },
    });
    msgsByDay.push({
      date: start.toISOString().slice(0, 10),
      count: c,
    });
  }

  // Distribuicao por hora (24h, ultimos 7 dias)
  const msgsByHour: number[] = Array(24).fill(0);
  const recentMsgs = await db.message.findMany({
    where: {
      conversation: { workspaceId: ws },
      direction: "in",
      timestamp: { gte: since7d },
    },
    select: { timestamp: true },
    take: 5000,
  });
  for (const m of recentMsgs) {
    msgsByHour[m.timestamp.getHours()]!++;
  }

  // Top 5 contatos mais ativos (mais mensagens nos ultimos 30 dias)
  const topContactsRaw = await db.message.groupBy({
    by: ["conversationId"],
    where: { conversation: { workspaceId: ws }, timestamp: { gte: since30d } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 5,
  });
  const topConvs = await db.conversation.findMany({
    where: { id: { in: topContactsRaw.map((t) => t.conversationId) } },
    include: { contact: { select: { name: true } } },
  });
  const topContacts = topContactsRaw.map((r) => {
    const conv = topConvs.find((c) => c.id === r.conversationId);
    return {
      conversationId: r.conversationId,
      name: conv?.contact.name ?? "—",
      count: r._count.id,
    };
  });

  // Status pie
  const statusBreakdown = {
    open: openConversations,
    pending: pendingConversations,
    resolved: resolvedConversations,
  };

  return NextResponse.json({
    summary: {
      totalConversations,
      openConversations,
      totalContacts,
      contacts30d,
      totalMessages,
      messages30d,
      msgsIn30d,
      msgsOut30d,
    },
    msgsByDay,
    msgsByHour,
    topContacts,
    statusBreakdown,
  });
}
