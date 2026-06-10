import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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

  // Mensagens por dia (30 dias) - 1 query agregada
  const start30d = new Date(now);
  start30d.setDate(now.getDate() - 29);
  start30d.setHours(0, 0, 0, 0);

  const [dailyRaw, hourlyRaw] = await Promise.all([
    db.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT DATE_TRUNC('day', m."timestamp") AS day, COUNT(*)::bigint AS count
      FROM "Message" m
      JOIN "Conversation" c ON c.id = m."conversationId"
      WHERE c."workspaceId" = ${ws}
        AND m."timestamp" >= ${start30d}
      GROUP BY day
      ORDER BY day
    `,
    db.$queryRaw<{ hr: number; count: bigint }[]>`
      SELECT EXTRACT(HOUR FROM m."timestamp")::int AS hr, COUNT(*)::bigint AS count
      FROM "Message" m
      JOIN "Conversation" c ON c.id = m."conversationId"
      WHERE c."workspaceId" = ${ws}
        AND m.direction = 'in'
        AND m."timestamp" >= ${since7d}
      GROUP BY hr
    `,
  ]);

  const dayMap = new Map<string, number>();
  for (const r of dailyRaw) dayMap.set(r.day.toISOString().slice(0, 10), Number(r.count));
  const msgsByDay: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    msgsByDay.push({ date: key, count: dayMap.get(key) ?? 0 });
  }

  const msgsByHour: number[] = Array(24).fill(0);
  for (const r of hourlyRaw) msgsByHour[r.hr] = Number(r.count);

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

  // === RANKING DE AGENTES ===
  // Conta mensagens "out" agrupadas por senderId nos ultimos 30 dias.
  // Mensagens da IA tem senderId=null e sao agregadas separadamente.
  // Tambem conta quantas conversas distintas cada agente atendeu (via
  // ConversationAssignment) — da uma nocao de carga distribuida.
  const [msgsByAgentRaw, convsByAgentRaw, agents] = await Promise.all([
    db.message.groupBy({
      by: ["senderId"],
      where: {
        conversation: { workspaceId: ws },
        direction: "out",
        timestamp: { gte: since30d },
      },
      _count: { id: true },
    }),
    db.conversationAssignment.groupBy({
      by: ["userId"],
      where: { conversation: { workspaceId: ws } },
      _count: { conversationId: true },
    }),
    db.user.findMany({
      where: { workspaceId: ws },
      select: {
        id: true,
        name: true,
        avatar: true,
        role: true,
        isOnline: true,
      },
    }),
  ]);

  const msgsByAgentMap = new Map<string | null, number>();
  for (const r of msgsByAgentRaw)
    msgsByAgentMap.set(r.senderId, Number(r._count.id));
  const convsByAgentMap = new Map<string, number>();
  for (const r of convsByAgentRaw)
    convsByAgentMap.set(r.userId, Number(r._count.conversationId));

  const agentRanking = agents
    .map((u) => ({
      id: u.id,
      name: u.name,
      avatar: u.avatar,
      role: u.role,
      isOnline: u.isOnline,
      messagesOut: msgsByAgentMap.get(u.id) ?? 0,
      conversations: convsByAgentMap.get(u.id) ?? 0,
    }))
    .sort((a, b) => b.messagesOut - a.messagesOut);

  // Linha extra pra IA (senderId=null em msgs out)
  const aiMessages = msgsByAgentMap.get(null) ?? 0;

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
    agentRanking,
    aiMessages,
  });
}
