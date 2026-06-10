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
  const prev30d = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 30d antes do periodo
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // === KPIs com periodo atual e anterior pra calcular trends ===
  const [
    totalConversations,
    openConversations,
    resolvedConversations,
    pendingConversations,
    totalContacts,
    contacts30d,
    contactsPrev30d,
    totalMessages,
    messages30d,
    messagesPrev30d,
    msgsIn30d,
    msgsOut30d,
    convs30d,
    convsPrev30d,
  ] = await Promise.all([
    db.conversation.count({ where: { workspaceId: ws } }),
    db.conversation.count({ where: { workspaceId: ws, status: "open" } }),
    db.conversation.count({ where: { workspaceId: ws, status: "resolved" } }),
    db.conversation.count({ where: { workspaceId: ws, status: "pending" } }),
    db.contact.count({ where: { workspaceId: ws } }),
    db.contact.count({ where: { workspaceId: ws, createdAt: { gte: since30d } } }),
    db.contact.count({
      where: {
        workspaceId: ws,
        createdAt: { gte: prev30d, lt: since30d },
      },
    }),
    db.message.count({ where: { conversation: { workspaceId: ws } } }),
    db.message.count({
      where: { conversation: { workspaceId: ws }, timestamp: { gte: since30d } },
    }),
    db.message.count({
      where: {
        conversation: { workspaceId: ws },
        timestamp: { gte: prev30d, lt: since30d },
      },
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
    db.conversation.count({
      where: { workspaceId: ws, createdAt: { gte: since30d } },
    }),
    db.conversation.count({
      where: {
        workspaceId: ws,
        createdAt: { gte: prev30d, lt: since30d },
      },
    }),
  ]);

  // === Mensagens por dia (30d) ===
  const start30d = new Date(now);
  start30d.setDate(now.getDate() - 29);
  start30d.setHours(0, 0, 0, 0);

  const [dailyRaw, hourlyRaw, weekdayHourRaw, contactsByDayRaw] = await Promise.all([
    db.$queryRaw<{ day: Date; ins: bigint; outs: bigint }[]>`
      SELECT
        DATE_TRUNC('day', m."timestamp") AS day,
        COUNT(*) FILTER (WHERE m.direction = 'in')::bigint AS ins,
        COUNT(*) FILTER (WHERE m.direction = 'out')::bigint AS outs
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
    // Heatmap dia-da-semana x hora (30 dias). Dia 0=Domingo, 6=Sabado.
    db.$queryRaw<{ wd: number; hr: number; count: bigint }[]>`
      SELECT
        EXTRACT(DOW FROM m."timestamp")::int AS wd,
        EXTRACT(HOUR FROM m."timestamp")::int AS hr,
        COUNT(*)::bigint AS count
      FROM "Message" m
      JOIN "Conversation" c ON c.id = m."conversationId"
      WHERE c."workspaceId" = ${ws}
        AND m.direction = 'in'
        AND m."timestamp" >= ${since30d}
      GROUP BY wd, hr
    `,
    // Novos contatos por dia
    db.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*)::bigint AS count
      FROM "Contact"
      WHERE "workspaceId" = ${ws}
        AND "createdAt" >= ${start30d}
      GROUP BY day
      ORDER BY day
    `,
  ]);

  const dayInMap = new Map<string, number>();
  const dayOutMap = new Map<string, number>();
  for (const r of dailyRaw) {
    const key = r.day.toISOString().slice(0, 10);
    dayInMap.set(key, Number(r.ins));
    dayOutMap.set(key, Number(r.outs));
  }
  const contactDayMap = new Map<string, number>();
  for (const r of contactsByDayRaw)
    contactDayMap.set(r.day.toISOString().slice(0, 10), Number(r.count));

  const msgsByDay: {
    date: string;
    total: number;
    ins: number;
    outs: number;
    newContacts: number;
  }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    const ins = dayInMap.get(key) ?? 0;
    const outs = dayOutMap.get(key) ?? 0;
    msgsByDay.push({
      date: key,
      total: ins + outs,
      ins,
      outs,
      newContacts: contactDayMap.get(key) ?? 0,
    });
  }

  const msgsByHour: number[] = Array(24).fill(0);
  for (const r of hourlyRaw) msgsByHour[r.hr] = Number(r.count);

  // Heatmap 7x24 (dia da semana x hora) — segunda=0 ate domingo=6 pra UI mais natural BR
  const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const r of weekdayHourRaw) {
    // PostgreSQL DOW: 0=domingo, 6=sabado. Convertendo pra: 0=segunda, 6=domingo.
    const wd = r.wd === 0 ? 6 : r.wd - 1;
    heatmap[wd]![r.hr] = Number(r.count);
  }

  // === Top 5 contatos mais ativos (com avatar) ===
  const topContactsRaw = await db.message.groupBy({
    by: ["conversationId"],
    where: { conversation: { workspaceId: ws }, timestamp: { gte: since30d } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 5,
  });
  const topConvs = await db.conversation.findMany({
    where: { id: { in: topContactsRaw.map((t) => t.conversationId) } },
    include: {
      contact: { select: { id: true, name: true, phone: true, avatar: true } },
    },
  });
  const topContacts = topContactsRaw
    .map((r) => {
      const conv = topConvs.find((c) => c.id === r.conversationId);
      if (!conv) return null;
      return {
        conversationId: r.conversationId,
        contactId: conv.contact.id,
        name: conv.contact.name,
        phone: conv.contact.phone,
        avatar: conv.contact.avatar,
        count: r._count.id,
      };
    })
    .filter(Boolean);

  // === Tempo medio de primeira resposta ===
  // Pega as 200 conversas mais recentes que ja tem resposta nossa, calcula
  // segundos entre 1a msg "in" e 1a msg "out" subsequente.
  const responseRaw = await db.$queryRaw<{ avg_seconds: number | null }[]>`
    WITH conv_first AS (
      SELECT
        c.id AS cid,
        (SELECT m."timestamp" FROM "Message" m
          WHERE m."conversationId" = c.id AND m.direction = 'in'
          ORDER BY m."timestamp" ASC LIMIT 1) AS first_in,
        (SELECT m."timestamp" FROM "Message" m
          WHERE m."conversationId" = c.id AND m.direction = 'out'
          ORDER BY m."timestamp" ASC LIMIT 1) AS first_out
      FROM "Conversation" c
      WHERE c."workspaceId" = ${ws}
        AND c."createdAt" >= ${since30d}
    )
    SELECT AVG(EXTRACT(EPOCH FROM (first_out - first_in)))::float AS avg_seconds
    FROM conv_first
    WHERE first_in IS NOT NULL
      AND first_out IS NOT NULL
      AND first_out > first_in
  `;
  const avgFirstResponseSeconds = Number(responseRaw[0]?.avg_seconds ?? 0);

  // === Ranking de agentes ===
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

  const aiMessages = msgsByAgentMap.get(null) ?? 0;

  // === Status breakdown ===
  const statusBreakdown = {
    open: openConversations,
    pending: pendingConversations,
    resolved: resolvedConversations,
  };

  // Helper pra calcular variacao percentual entre 2 periodos
  const pct = (curr: number, prev: number): number => {
    if (prev === 0) return curr === 0 ? 0 : 100;
    return Math.round(((curr - prev) / prev) * 100);
  };

  return NextResponse.json({
    summary: {
      totalConversations,
      openConversations,
      totalContacts,
      contacts30d,
      contacts30dTrend: pct(contacts30d, contactsPrev30d),
      totalMessages,
      messages30d,
      messages30dTrend: pct(messages30d, messagesPrev30d),
      convs30d,
      convs30dTrend: pct(convs30d, convsPrev30d),
      msgsIn30d,
      msgsOut30d,
      avgFirstResponseSeconds,
    },
    msgsByDay,
    msgsByHour,
    heatmap,
    topContacts,
    statusBreakdown,
    agentRanking,
    aiMessages,
  });
}
