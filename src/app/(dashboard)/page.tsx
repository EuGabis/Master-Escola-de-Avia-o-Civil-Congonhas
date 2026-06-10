import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  MessagesSquare,
  Users,
  Inbox,
  ArrowRight,
  Send,
  Clock,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Bot,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { UserAvatar } from "@/components/UserAvatar";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const prev24h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const prev7d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Inicio do dia 0 (hoje na 0h) — usado pra heatmap por dia
  const start7d = new Date(now);
  start7d.setDate(now.getDate() - 6);
  start7d.setHours(0, 0, 0, 0);

  const [
    convStats,
    contactStats,
    msgStats,
    dayStats,
    lastConvs,
    aiStats,
    responseRaw,
  ] = await Promise.all([
    db.$queryRaw<{ total: bigint; open: bigint; resolved: bigint }[]>`
      SELECT
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE status = 'open')::bigint AS open,
        COUNT(*) FILTER (WHERE status = 'resolved')::bigint AS resolved
      FROM "Conversation"
      WHERE "workspaceId" = ${session.wid}
    `,
    db.$queryRaw<{ total: bigint; d7: bigint; prev7d: bigint }[]>`
      SELECT
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE "createdAt" >= ${since7d})::bigint AS d7,
        COUNT(*) FILTER (WHERE "createdAt" >= ${prev7d} AND "createdAt" < ${since7d})::bigint AS prev7d
      FROM "Contact"
      WHERE "workspaceId" = ${session.wid}
    `,
    db.$queryRaw<
      {
        total: bigint;
        h24: bigint;
        prev24h: bigint;
        h24_in: bigint;
        h24_out: bigint;
        d7: bigint;
        prev7d: bigint;
      }[]
    >`
      SELECT
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE m."timestamp" >= ${since24h})::bigint AS h24,
        COUNT(*) FILTER (WHERE m."timestamp" >= ${prev24h} AND m."timestamp" < ${since24h})::bigint AS prev24h,
        COUNT(*) FILTER (WHERE m."timestamp" >= ${since24h} AND m.direction = 'in')::bigint AS h24_in,
        COUNT(*) FILTER (WHERE m."timestamp" >= ${since24h} AND m.direction = 'out')::bigint AS h24_out,
        COUNT(*) FILTER (WHERE m."timestamp" >= ${since7d})::bigint AS d7,
        COUNT(*) FILTER (WHERE m."timestamp" >= ${prev7d} AND m."timestamp" < ${since7d})::bigint AS prev7d
      FROM "Message" m
      JOIN "Conversation" c ON c.id = m."conversationId"
      WHERE c."workspaceId" = ${session.wid}
    `,
    db.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT DATE_TRUNC('day', m."timestamp") AS day, COUNT(*)::bigint AS count
      FROM "Message" m
      JOIN "Conversation" c ON c.id = m."conversationId"
      WHERE c."workspaceId" = ${session.wid}
        AND m."timestamp" >= ${start7d}
      GROUP BY day
      ORDER BY day
    `,
    db.conversation.findMany({
      where: { workspaceId: session.wid },
      orderBy: { lastMessageAt: "desc" },
      take: 8,
      select: {
        id: true,
        lastMessage: true,
        lastMessageAt: true,
        unreadCount: true,
        contact: {
          select: { id: true, name: true, phone: true, avatar: true },
        },
      },
    }),
    db.$queryRaw<{ ai: bigint; human: bigint }[]>`
      SELECT
        COUNT(*) FILTER (WHERE m."senderId" IS NULL)::bigint AS ai,
        COUNT(*) FILTER (WHERE m."senderId" IS NOT NULL)::bigint AS human
      FROM "Message" m
      JOIN "Conversation" c ON c.id = m."conversationId"
      WHERE c."workspaceId" = ${session.wid}
        AND m.direction = 'out'
        AND m."timestamp" >= ${since24h}
    `,
    db.$queryRaw<{ avg_seconds: number | null }[]>`
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
        WHERE c."workspaceId" = ${session.wid}
          AND c."createdAt" >= ${since7d}
      )
      SELECT AVG(EXTRACT(EPOCH FROM (first_out - first_in)))::float AS avg_seconds
      FROM conv_first
      WHERE first_in IS NOT NULL
        AND first_out IS NOT NULL
        AND first_out > first_in
    `,
  ]);

  const totalConv = Number(convStats[0]?.total ?? 0);
  const openConv = Number(convStats[0]?.open ?? 0);
  const resolvedConv = Number(convStats[0]?.resolved ?? 0);
  const totalContacts = Number(contactStats[0]?.total ?? 0);
  const newContacts7d = Number(contactStats[0]?.d7 ?? 0);
  const newContactsPrev7d = Number(contactStats[0]?.prev7d ?? 0);
  const msgsTotal = Number(msgStats[0]?.total ?? 0);
  const msgs24h = Number(msgStats[0]?.h24 ?? 0);
  const msgsPrev24h = Number(msgStats[0]?.prev24h ?? 0);
  const msgsIn24h = Number(msgStats[0]?.h24_in ?? 0);
  const msgsOut24h = Number(msgStats[0]?.h24_out ?? 0);
  const msgs7d = Number(msgStats[0]?.d7 ?? 0);
  const msgsPrev7d = Number(msgStats[0]?.prev7d ?? 0);
  const aiMsgs24h = Number(aiStats[0]?.ai ?? 0);
  const humanMsgs24h = Number(aiStats[0]?.human ?? 0);
  const avgResponseSec = Number(responseRaw[0]?.avg_seconds ?? 0);

  const userName = session.name ?? session.email;

  // Monta msgsByDay (7 dias)
  const dayMap = new Map<string, number>();
  for (const r of dayStats)
    dayMap.set(r.day.toISOString().slice(0, 10), Number(r.count));
  const msgsByDay: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    msgsByDay.push({
      date: d.toISOString().slice(0, 10),
      count: dayMap.get(d.toISOString().slice(0, 10)) ?? 0,
    });
  }

  const trendPct = (curr: number, prev: number): number => {
    if (prev === 0) return curr === 0 ? 0 : 100;
    return Math.round(((curr - prev) / prev) * 100);
  };

  const resolutionRate =
    totalConv > 0 ? Math.round((resolvedConv / totalConv) * 100) : 0;
  const aiAutomation =
    aiMsgs24h + humanMsgs24h > 0
      ? Math.round((aiMsgs24h / (aiMsgs24h + humanMsgs24h)) * 100)
      : 0;

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      {/* HEADER */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">
              Olá, {userName.split(" ")[0]}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5 capitalize">
              {now.toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
          <Link
            href="/conversations"
            className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-master-orange hover:bg-master-orange-600 text-white text-sm font-semibold px-4 py-2 transition-all duration-150 shadow-md shadow-master-orange/30 active:scale-[0.98]"
          >
            <Inbox size={16} />
            Abrir Inbox
            {openConv > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-white text-master-orange text-[11px] font-bold px-1.5">
                {openConv}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* CONTEUDO */}
      <div className="px-4 md:px-8 py-6 space-y-6 max-w-6xl mx-auto">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi
            label="Em aberto"
            value={openConv}
            sub={`de ${totalConv} conversas`}
            icon={Inbox}
            accent
          />
          <Kpi
            label="Mensagens 24h"
            value={msgs24h}
            trend={trendPct(msgs24h, msgsPrev24h)}
            sub={`${msgsIn24h} in · ${msgsOut24h} out`}
            icon={Send}
            sparkline={msgsByDay.map((d) => d.count)}
          />
          <Kpi
            label="Mensagens 7 dias"
            value={msgs7d}
            trend={trendPct(msgs7d, msgsPrev7d)}
            sub={`${msgsTotal.toLocaleString("pt-BR")} no total`}
            icon={Activity}
            sparkline={msgsByDay.map((d) => d.count)}
          />
          <Kpi
            label="Novos contatos 7d"
            value={newContacts7d}
            trend={trendPct(newContacts7d, newContactsPrev7d)}
            sub={`${totalContacts.toLocaleString("pt-BR")} cadastrados`}
            icon={Users}
          />
        </div>

        {/* CHART + RECENTES */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
            <header className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white text-sm">
                  Mensagens nos últimos 7 dias
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Volume diário consolidado
                </p>
              </div>
              <span className="text-xs font-medium text-slate-500">
                <strong className="text-slate-900 dark:text-white tabular-nums">
                  {msgs7d.toLocaleString("pt-BR")}
                </strong>{" "}
                no período
              </span>
            </header>
            <DailyChart data={msgsByDay} />
          </div>

          {/* Conversas recentes */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[480px]">
            <header className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-semibold text-slate-900 dark:text-white text-sm">
                Recentes
              </h2>
              <Link
                href="/conversations"
                className="text-xs text-master-orange hover:underline flex items-center gap-1 font-medium"
              >
                Ver todas <ArrowRight size={12} />
              </Link>
            </header>
            <div className="flex-1 divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto">
              {lastConvs.length === 0 ? (
                <div className="p-6 text-center">
                  <MessagesSquare
                    size={24}
                    className="text-slate-300 dark:text-slate-700 mx-auto mb-2"
                  />
                  <p className="text-xs text-slate-500">
                    Aguardando primeiras mensagens...
                  </p>
                </div>
              ) : (
                lastConvs.map((c) => (
                  <Link
                    key={c.id}
                    href={`/conversations?id=${c.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                  >
                    <UserAvatar
                      name={c.contact.name}
                      avatar={c.contact.avatar}
                      size={36}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {c.contact.name}
                        </div>
                        {c.lastMessageAt && (
                          <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">
                            {relativeTime(new Date(c.lastMessageAt), now)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <div className="text-xs text-slate-500 truncate min-w-0">
                          {c.lastMessage ?? "—"}
                        </div>
                        {c.unreadCount > 0 && (
                          <span className="bg-master-orange text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 shrink-0 min-w-[18px] text-center">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* INFO ROW — agora com dados reais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoCard
            icon={Clock}
            label="Tempo médio de resposta"
            value={
              avgResponseSec > 0
                ? formatDuration(avgResponseSec)
                : "—"
            }
            hint={
              avgResponseSec > 0
                ? `Última semana · ${responseQuality(avgResponseSec)}`
                : "Sem conversas respondidas ainda"
            }
            accent={
              avgResponseSec > 0 && avgResponseSec < 300 ? "good" : undefined
            }
          />
          <InfoCard
            icon={CheckCircle2}
            label="Taxa de resolução"
            value={totalConv > 0 ? `${resolutionRate}%` : "—"}
            hint={`${resolvedConv} de ${totalConv} conversas resolvidas`}
            accent={resolutionRate >= 50 ? "good" : undefined}
          />
          <InfoCard
            icon={Bot}
            label="Automatizado pela IA (24h)"
            value={aiMsgs24h + humanMsgs24h > 0 ? `${aiAutomation}%` : "—"}
            hint={
              aiMsgs24h + humanMsgs24h > 0
                ? `${aiMsgs24h.toLocaleString("pt-BR")} pela IA · ${humanMsgs24h.toLocaleString("pt-BR")} humanas`
                : "Sem mensagens enviadas nas últimas 24h"
            }
            accent="brand"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Gráfico de área SVG (7 dias) — igual ao do Analytics em escala menor
// ============================================================

function DailyChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const W = 700;
  const H = 180;
  const padL = 28;
  const padR = 8;
  const padT = 12;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xAt = (i: number) =>
    padL + (i / Math.max(1, data.length - 1)) * innerW;
  const yAt = (v: number) => padT + innerH - (v / max) * innerH;

  const linePoints = data.map((d, i) => `${xAt(i)},${yAt(d.count)}`).join(" ");
  const areaPath = `M ${padL},${padT + innerH} L ${data
    .map((d, i) => `${xAt(i)},${yAt(d.count)}`)
    .join(" L ")} L ${xAt(data.length - 1)},${padT + innerH} Z`;
  const ticks = [0, 0.5, 1].map((p) => ({
    y: padT + innerH * (1 - p),
    label: Math.round(max * p),
  }));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-44"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="dash-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F26522" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#F26522" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={padL}
            x2={W - padR}
            y1={t.y}
            y2={t.y}
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="3 4"
            className="text-slate-200 dark:text-slate-800"
          />
          <text
            x={padL - 6}
            y={t.y + 3}
            textAnchor="end"
            className="fill-slate-400 text-[10px] tabular-nums"
          >
            {t.label}
          </text>
        </g>
      ))}
      <path d={areaPath} fill="url(#dash-area)" />
      <polyline
        points={linePoints}
        fill="none"
        stroke="#F26522"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.map((d, i) => (
        <circle
          key={i}
          cx={xAt(i)}
          cy={yAt(d.count)}
          r={i === data.length - 1 ? 4 : 2.5}
          fill="white"
          stroke="#F26522"
          strokeWidth={i === data.length - 1 ? 2.5 : 2}
        >
          <title>{`${new Date(d.date).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" })}: ${d.count} mensagens`}</title>
        </circle>
      ))}
      {data.map((d, i) => {
        const date = new Date(d.date);
        const isToday = i === data.length - 1;
        return (
          <text
            key={i}
            x={xAt(i)}
            y={H - 10}
            textAnchor="middle"
            className={cn(
              "text-[10px]",
              isToday
                ? "fill-master-orange font-bold"
                : "fill-slate-400 dark:fill-slate-500"
            )}
          >
            {isToday
              ? "Hoje"
              : date
                  .toLocaleDateString("pt-BR", { weekday: "short" })
                  .replace(".", "")}
          </text>
        );
      })}
    </svg>
  );
}

// ============================================================
// KPI Card com sparkline + trend
// ============================================================

function Kpi({
  label,
  value,
  sub,
  trend,
  sparkline,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  sub?: string;
  trend?: number;
  sparkline?: number[];
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "group rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5",
        accent
          ? "border-master-orange/30 bg-master-orange/5 dark:bg-master-orange/10 hover:shadow-lg hover:shadow-master-orange/15"
          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold">
            {label}
          </div>
          <div className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white mt-1.5 leading-none tabular-nums">
            {value.toLocaleString("pt-BR")}
          </div>
          {trend !== undefined ? (
            <TrendBadge trend={trend} />
          ) : sub ? (
            <div className="text-[11px] text-slate-500 mt-2 truncate">
              {sub}
            </div>
          ) : null}
        </div>
        <div
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
            accent
              ? "bg-master-orange text-white shadow-md shadow-master-orange/30"
              : "bg-slate-100 dark:bg-slate-800 text-slate-500"
          )}
        >
          <Icon size={16} />
        </div>
      </div>
      {sparkline && sparkline.length > 1 && (
        <div className="mt-2.5">
          <Sparkline data={sparkline} color={accent ? "#F26522" : "#94a3b8"} />
        </div>
      )}
      {trend !== undefined && sub && (
        <div className="text-[11px] text-slate-500 mt-2 truncate">{sub}</div>
      )}
    </div>
  );
}

function TrendBadge({ trend }: { trend: number }) {
  const up = trend > 0;
  const flat = trend === 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded mt-2",
        flat
          ? "bg-slate-100 dark:bg-slate-800 text-slate-500"
          : up
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "bg-red-500/10 text-red-600 dark:text-red-400"
      )}
    >
      {flat ? (
        <Minus size={10} />
      ) : up ? (
        <TrendingUp size={10} />
      ) : (
        <TrendingDown size={10} />
      )}
      {flat ? "0%" : `${up ? "+" : ""}${trend}%`}
    </span>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(1, ...data);
  const width = 100;
  const height = 22;
  const step = width / Math.max(1, data.length - 1);
  const points = data.map(
    (v, i) => `${i * step},${height - (v / max) * height}`
  );
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full h-5"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ============================================================
// Info Card (linha embaixo) — agora com dados reais
// ============================================================

function InfoCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  hint: string;
  accent?: "good" | "brand";
}) {
  const iconBg =
    accent === "good"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : accent === "brand"
        ? "bg-master-orange/10 text-master-orange"
        : "bg-slate-100 dark:bg-slate-800 text-slate-500";

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center gap-4 transition hover:-translate-y-0.5 hover:shadow-md">
      <div
        className={cn(
          "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
          iconBg
        )}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          {label}
        </div>
        <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5 leading-none tabular-nums">
          {value}
        </div>
        <div className="text-[11px] text-slate-500 mt-1.5 truncate">
          {hint}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function formatDuration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  if (sec < 86400) return `${(sec / 3600).toFixed(1)} h`;
  return `${(sec / 86400).toFixed(1)} d`;
}

function responseQuality(sec: number): string {
  if (sec < 60) return "excepcional";
  if (sec < 300) return "ótimo";
  if (sec < 1800) return "bom";
  if (sec < 7200) return "médio";
  return "lento";
}

function relativeTime(then: Date, now: Date): string {
  const diff = (now.getTime() - then.getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 604800)}sem`;
}
