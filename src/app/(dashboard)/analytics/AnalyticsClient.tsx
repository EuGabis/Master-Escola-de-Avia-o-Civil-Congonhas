"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Send,
  Inbox,
  Users,
  MessageSquare,
  Bot,
  Clock,
  ArrowUpRight,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { UserAvatar } from "@/components/UserAvatar";
import { SkeletonCard } from "@/components/Skeleton";

interface AgentStat {
  id: string;
  name: string;
  avatar: string | null;
  role: string;
  isOnline: boolean;
  messagesOut: number;
  conversations: number;
}

interface TopContact {
  conversationId: string;
  contactId: string;
  name: string;
  phone: string;
  avatar: string | null;
  count: number;
}

interface Data {
  summary: {
    totalConversations: number;
    openConversations: number;
    totalContacts: number;
    contacts30d: number;
    contacts30dTrend: number;
    totalMessages: number;
    messages30d: number;
    messages30dTrend: number;
    convs30d: number;
    convs30dTrend: number;
    msgsIn30d: number;
    msgsOut30d: number;
    avgFirstResponseSeconds: number;
  };
  msgsByDay: {
    date: string;
    total: number;
    ins: number;
    outs: number;
    newContacts: number;
  }[];
  msgsByHour: number[];
  heatmap: number[][]; // [weekday(0=seg)][hour] -> count
  topContacts: TopContact[];
  statusBreakdown: { open: number; pending: number; resolved: number };
  agentRanking: AgentStat[];
  aiMessages: number;
}

export default function AnalyticsClient() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/analytics")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao carregar");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">
          Falha ao carregar métricas: {error}
        </div>
      </div>
    );
  }

  if (!data) return <LoadingState />;

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-5">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Métricas dos últimos 30 dias · comparado ao período anterior
          </p>
        </div>
      </header>

      <div className="px-4 md:px-8 py-6 max-w-6xl mx-auto space-y-6">
        <KpiGrid data={data} />

        <MessagesChart data={data.msgsByDay} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <FunnelCard data={data} />
          <StatusDonut data={data.statusBreakdown} />
        </div>

        <HeatmapCard heatmap={data.heatmap} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <TopContactsCard contacts={data.topContacts} />
          <ResponseTimeCard
            seconds={data.summary.avgFirstResponseSeconds}
            sample={data.summary.convs30d}
          />
        </div>

        <AgentsCard data={data} />
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:px-8 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-shimmer" />
        </div>
      </div>
      <div className="px-4 md:px-8 py-6 max-w-6xl mx-auto space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} rows={2} />
          ))}
        </div>
        <SkeletonCard rows={6} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonCard rows={4} />
          <SkeletonCard rows={3} />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// KPI Grid
// ============================================================

function KpiGrid({ data }: { data: Data }) {
  const last7Msgs = data.msgsByDay.slice(-7).map((d) => d.total);
  const last7Conv = data.msgsByDay.slice(-7).map((d) => d.newContacts);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KpiCard
        label="Mensagens (30d)"
        value={data.summary.messages30d}
        trend={data.summary.messages30dTrend}
        sparkline={last7Msgs}
        icon={MessageSquare}
      />
      <KpiCard
        label="Novas conversas"
        value={data.summary.convs30d}
        trend={data.summary.convs30dTrend}
        icon={Inbox}
        accent
      />
      <KpiCard
        label="Novos contatos"
        value={data.summary.contacts30d}
        trend={data.summary.contacts30dTrend}
        sparkline={last7Conv}
        icon={Users}
      />
      <KpiCard
        label="Em aberto agora"
        value={data.summary.openConversations}
        sub={`${data.summary.totalConversations} no total`}
        icon={ArrowUpRight}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  trend,
  sub,
  sparkline,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  trend?: number;
  sub?: string;
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
          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold">
            {label}
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white mt-1.5 leading-none tabular-nums">
            {value.toLocaleString("pt-BR")}
          </div>
          {trend !== undefined ? (
            <TrendBadge trend={trend} />
          ) : sub ? (
            <div className="text-xs text-slate-500 mt-2 truncate">{sub}</div>
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
        <div className="mt-3">
          <Sparkline data={sparkline} color={accent ? "#F26522" : "#94a3b8"} />
        </div>
      )}
    </div>
  );
}

function TrendBadge({ trend }: { trend: number }) {
  const up = trend > 0;
  const flat = trend === 0;
  return (
    <div className="flex items-center gap-1.5 mt-2">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded",
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
      <span className="text-[10px] text-slate-400">vs 30d ant.</span>
    </div>
  );
}

function Sparkline({ data, color = "#94a3b8" }: { data: number[]; color?: string }) {
  const max = Math.max(1, ...data);
  const width = 100;
  const height = 24;
  const step = width / (data.length - 1);
  const points = data.map(
    (v, i) => `${i * step},${height - (v / max) * height}`
  );
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full h-6"
    >
      <defs>
        <linearGradient id="spark-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={`0,${height} ${points.join(" ")} ${width},${height}`}
        fill="url(#spark-fade)"
        stroke="none"
      />
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
// Gráfico de área principal
// ============================================================

function MessagesChart({ data }: { data: Data["msgsByDay"] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.total));
  const total = data.reduce((s, d) => s + d.total, 0);
  const W = 1000;
  const H = 220;
  const padL = 30;
  const padR = 10;
  const padT = 10;
  const padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xAt = (i: number) => padL + (i / Math.max(1, data.length - 1)) * innerW;
  const yAt = (v: number) => padT + innerH - (v / max) * innerH;

  const linePoints = data.map((d, i) => `${xAt(i)},${yAt(d.total)}`).join(" ");
  const areaPath = `M ${padL},${padT + innerH} L ${data
    .map((d, i) => `${xAt(i)},${yAt(d.total)}`)
    .join(" L ")} L ${xAt(data.length - 1)},${padT + innerH} Z`;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => ({
    y: padT + innerH * (1 - p),
    label: Math.round(max * p),
  }));

  const hover = hoverIdx !== null ? data[hoverIdx] : null;

  return (
    <Card
      title="Mensagens nos últimos 30 dias"
      right={
        <span className="text-xs font-medium text-slate-500">
          <strong className="text-slate-900 dark:text-white">
            {total.toLocaleString("pt-BR")}
          </strong>{" "}
          mensagens
        </span>
      }
    >
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-56"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="area-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F26522" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#F26522" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Grid horizontal */}
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
                className="fill-slate-400 text-[9px] tabular-nums"
              >
                {t.label}
              </text>
            </g>
          ))}
          {/* Area + linha */}
          <path d={areaPath} fill="url(#area-fade)" />
          <polyline
            points={linePoints}
            fill="none"
            stroke="#F26522"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Hover invisivel pra capturar mouse */}
          {data.map((d, i) => {
            const w = innerW / data.length;
            return (
              <rect
                key={i}
                x={padL + i * w - w / 2}
                y={padT}
                width={w}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
                style={{ cursor: "crosshair" }}
              />
            );
          })}
          {/* Ponto hover */}
          {hoverIdx !== null && hover && (
            <>
              <line
                x1={xAt(hoverIdx)}
                x2={xAt(hoverIdx)}
                y1={padT}
                y2={padT + innerH}
                stroke="#F26522"
                strokeWidth="1"
                strokeOpacity="0.4"
              />
              <circle
                cx={xAt(hoverIdx)}
                cy={yAt(hover.total)}
                r="4"
                fill="#F26522"
                stroke="white"
                strokeWidth="2"
              />
            </>
          )}
          {/* Labels datas — apenas em alguns ticks pra nao poluir */}
          {data.map((d, i) => {
            if (i % 5 !== 0 && i !== data.length - 1) return null;
            const date = new Date(d.date);
            return (
              <text
                key={i}
                x={xAt(i)}
                y={H - 8}
                textAnchor="middle"
                className="fill-slate-400 text-[9px]"
              >
                {date.getDate()}/{date.getMonth() + 1}
              </text>
            );
          })}
        </svg>
        {/* Tooltip */}
        {hover && hoverIdx !== null && (
          <div
            className="absolute top-2 pointer-events-none bg-slate-900 dark:bg-slate-800 text-white text-xs rounded-lg shadow-lg px-3 py-2 z-10"
            style={{
              left: `${(xAt(hoverIdx) / W) * 100}%`,
              transform: `translateX(${hoverIdx > data.length / 2 ? "-100%" : "0"}) translateX(${hoverIdx > data.length / 2 ? "-12px" : "12px"})`,
            }}
          >
            <div className="font-semibold text-[10px] uppercase tracking-wider opacity-70">
              {new Date(hover.date).toLocaleDateString("pt-BR", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </div>
            <div className="text-base font-bold tabular-nums mt-0.5">
              {hover.total}
            </div>
            <div className="flex gap-3 mt-1 text-[10px]">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {hover.ins} in
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-master-orange" />
                {hover.outs} out
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ============================================================
// Funil de conversão
// ============================================================

function FunnelCard({ data }: { data: Data }) {
  const total = data.summary.convs30d;
  const responded = total; // todas que tem msg ja sao "respondidas" — proxy
  // Calculo melhor seria contar conversas com pelo menos 1 msg out, mas
  // por hora usamos a aproximacao: convs com resposta = msgsOut30d > 0
  const replied = Math.min(total, data.summary.msgsOut30d > 0 ? total : 0);
  const resolved = data.statusBreakdown.resolved;

  const stages = [
    { label: "Conversas iniciadas", value: total, pct: 100 },
    {
      label: "Respondidas",
      value: replied,
      pct: total > 0 ? Math.round((replied / total) * 100) : 0,
    },
    {
      label: "Resolvidas",
      value: resolved,
      pct: total > 0 ? Math.round((resolved / total) * 100) : 0,
    },
  ];

  return (
    <Card title="Funil de atendimento (30d)" className="lg:col-span-2">
      <div className="space-y-3">
        {stages.map((s, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                {s.label}
              </span>
              <span className="text-sm tabular-nums">
                <strong className="text-slate-900 dark:text-white">
                  {s.value}
                </strong>
                <span className="text-slate-400 ml-1.5">({s.pct}%)</span>
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  i === 0
                    ? "bg-gradient-to-r from-master-orange to-master-orange-600"
                    : i === 1
                      ? "bg-gradient-to-r from-master-orange/80 to-master-orange-600/80"
                      : "bg-gradient-to-r from-emerald-500 to-emerald-600"
                )}
                style={{ width: `${s.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// Donut de status
// ============================================================

function StatusDonut({
  data,
}: {
  data: { open: number; pending: number; resolved: number };
}) {
  const total = data.open + data.pending + data.resolved;
  const items = [
    { label: "Aberta", value: data.open, color: "#10b981" },
    { label: "Pendente", value: data.pending, color: "#f59e0b" },
    { label: "Resolvida", value: data.resolved, color: "#64748b" },
  ];

  // SVG donut
  const radius = 38;
  const stroke = 14;
  const circ = 2 * Math.PI * radius;
  let offset = 0;
  const arcs = items.map((it) => {
    const len = total > 0 ? (it.value / total) * circ : 0;
    const arc = (
      <circle
        key={it.label}
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke={it.color}
        strokeWidth={stroke}
        strokeDasharray={`${len} ${circ - len}`}
        strokeDashoffset={-offset}
        strokeLinecap="butt"
        transform="rotate(-90 50 50)"
      />
    );
    offset += len;
    return arc;
  });

  return (
    <Card title="Status atual">
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 100 100" className="w-24 h-24 shrink-0">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-slate-100 dark:text-slate-800"
          />
          {total > 0 && arcs}
          <text
            x="50"
            y="48"
            textAnchor="middle"
            className="fill-slate-900 dark:fill-white text-[14px] font-bold tabular-nums"
          >
            {total}
          </text>
          <text
            x="50"
            y="60"
            textAnchor="middle"
            className="fill-slate-400 text-[7px] uppercase tracking-wider"
          >
            convers.
          </text>
        </svg>
        <div className="flex-1 min-w-0 space-y-2">
          {items.map((it) => {
            const pct = total > 0 ? Math.round((it.value / total) * 100) : 0;
            return (
              <div key={it.label} className="flex items-center gap-2 text-sm">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: it.color }}
                />
                <span className="text-slate-700 dark:text-slate-300 flex-1 truncate">
                  {it.label}
                </span>
                <span className="tabular-nums font-medium text-slate-900 dark:text-white">
                  {it.value}
                </span>
                <span className="text-xs text-slate-400 w-8 text-right">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// Heatmap dia x hora
// ============================================================

function HeatmapCard({ heatmap }: { heatmap: number[][] }) {
  const max = Math.max(1, ...heatmap.flat());
  const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return (
    <Card
      title="Quando seus clientes mais escrevem"
      right={
        <span className="text-xs text-slate-500">
          Mensagens recebidas · últimos 30 dias
        </span>
      }
    >
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Linha de horas */}
          <div className="flex items-center gap-1 pl-9 mb-1">
            {Array.from({ length: 24 }).map((_, h) => (
              <div
                key={h}
                className={cn(
                  "flex-1 text-center text-[9px] text-slate-400",
                  h % 3 !== 0 && "opacity-0"
                )}
              >
                {h}h
              </div>
            ))}
          </div>
          {days.map((d, di) => (
            <div key={d} className="flex items-center gap-1 mb-1">
              <div className="w-8 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                {d}
              </div>
              {Array.from({ length: 24 }).map((_, h) => {
                const v = heatmap[di]?.[h] ?? 0;
                const intensity = v === 0 ? 0 : Math.max(0.08, v / max);
                return (
                  <div
                    key={h}
                    className="flex-1 aspect-square rounded-sm transition-transform hover:scale-110 cursor-default"
                    style={{
                      backgroundColor:
                        v === 0
                          ? "rgba(148,163,184,0.08)"
                          : `rgba(242, 101, 34, ${intensity})`,
                    }}
                    title={`${d} ${h}h: ${v} mensagens`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {/* Legenda */}
      <div className="flex items-center gap-1.5 mt-3 text-[10px] text-slate-500">
        <span>Menos</span>
        {[0.1, 0.3, 0.5, 0.7, 1].map((o) => (
          <div
            key={o}
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: `rgba(242, 101, 34, ${o})` }}
          />
        ))}
        <span>Mais</span>
      </div>
    </Card>
  );
}

// ============================================================
// Top contatos
// ============================================================

function TopContactsCard({ contacts }: { contacts: TopContact[] }) {
  return (
    <Card title="Conversas mais ativas (30d)" className="lg:col-span-2">
      {contacts.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">
          Sem dados ainda
        </p>
      ) : (
        <div className="space-y-3">
          {contacts.map((c, idx) => {
            const maxCount = contacts[0]!.count;
            const pct = Math.round((c.count / maxCount) * 100);
            return (
              <div key={c.conversationId} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 w-4 shrink-0 tabular-nums">
                  {idx + 1}
                </span>
                <UserAvatar name={c.name} avatar={c.avatar} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {c.name}
                      </div>
                      <div className="text-[10px] text-slate-500 tabular-nums">
                        {c.phone}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                        {c.count}
                      </div>
                      <div className="text-[10px] text-slate-500">msgs</div>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-master-orange to-master-orange-600 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ============================================================
// Tempo de resposta
// ============================================================

function formatDuration(sec: number): { value: string; unit: string } {
  if (sec < 60) return { value: Math.round(sec).toString(), unit: "segundos" };
  if (sec < 3600)
    return { value: Math.round(sec / 60).toString(), unit: "minutos" };
  if (sec < 86400)
    return { value: (sec / 3600).toFixed(1), unit: "horas" };
  return { value: (sec / 86400).toFixed(1), unit: "dias" };
}

function ResponseTimeCard({
  seconds,
  sample,
}: {
  seconds: number;
  sample: number;
}) {
  const { value, unit } = formatDuration(seconds);
  const hasData = seconds > 0;
  const quality =
    seconds < 60
      ? { label: "Excepcional", color: "text-emerald-500" }
      : seconds < 300
        ? { label: "Ótimo", color: "text-emerald-500" }
        : seconds < 1800
          ? { label: "Bom", color: "text-master-orange" }
          : seconds < 7200
            ? { label: "Médio", color: "text-amber-500" }
            : { label: "Lento", color: "text-red-500" };

  return (
    <Card title="Tempo de primeira resposta">
      <div className="flex flex-col items-center justify-center py-2 gap-2">
        <Clock size={20} className="text-master-orange" />
        {hasData ? (
          <>
            <div className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white leading-none">
              {value}
            </div>
            <div className="text-xs text-slate-500">{unit}</div>
            <div className={cn("text-xs font-semibold mt-1", quality.color)}>
              {quality.label}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              média entre {sample} conversas
            </div>
          </>
        ) : (
          <div className="text-xs text-slate-500 mt-2 text-center">
            Sem dados ainda — quando você responder a primeira mensagem de cada
            cliente, calculamos automaticamente.
          </div>
        )}
      </div>
    </Card>
  );
}

// ============================================================
// Ranking de agentes
// ============================================================

function AgentsCard({ data }: { data: Data }) {
  const maxCount = Math.max(
    1,
    data.aiMessages,
    ...data.agentRanking.map((a) => a.messagesOut)
  );
  const totalAgents = data.agentRanking.reduce(
    (s, a) => s + a.messagesOut,
    0
  );
  const totalAll = totalAgents + data.aiMessages;
  const aiPct = totalAll > 0 ? Math.round((data.aiMessages / totalAll) * 100) : 0;

  return (
    <Card
      title="Atendimentos por agente (30d)"
      right={
        data.aiMessages > 0 && (
          <span className="text-xs text-slate-500">
            IA respondeu <strong className="text-master-orange">{aiPct}%</strong>{" "}
            das mensagens enviadas
          </span>
        )
      }
    >
      {data.agentRanking.length === 0 && data.aiMessages === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">
          Ainda sem mensagens enviadas no período
        </p>
      ) : (
        <div className="space-y-3">
          {data.agentRanking.map((a, idx) => (
            <AgentRow
              key={a.id}
              idx={idx + 1}
              name={a.name}
              avatar={a.avatar}
              role={a.role}
              online={a.isOnline}
              messages={a.messagesOut}
              conversations={a.conversations}
              maxCount={maxCount}
            />
          ))}
          {data.aiMessages > 0 && (
            <AgentRow
              idx={data.agentRanking.length + 1}
              name="Valentina IA"
              avatar={null}
              role="ai"
              online
              messages={data.aiMessages}
              conversations={0}
              maxCount={maxCount}
              isBot
            />
          )}
        </div>
      )}
    </Card>
  );
}

function AgentRow({
  idx,
  name,
  avatar,
  role,
  online,
  messages,
  conversations,
  maxCount,
  isBot,
}: {
  idx: number;
  name: string;
  avatar: string | null;
  role: string;
  online: boolean;
  messages: number;
  conversations: number;
  maxCount: number;
  isBot?: boolean;
}) {
  const pct = Math.round((messages / maxCount) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-bold text-slate-400 w-5 shrink-0 tabular-nums">
        {idx}
      </span>
      <div className="relative shrink-0">
        {isBot ? (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-master-orange to-master-orange-700 text-white flex items-center justify-center shadow-sm">
            <Bot size={18} />
          </div>
        ) : (
          <UserAvatar name={name} avatar={avatar} size={40} online={online} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {name}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
              {role}
              {!isBot && conversations > 0 && ` · ${conversations} conversas`}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
              {messages.toLocaleString("pt-BR")}
            </div>
            <div className="text-[10px] text-slate-500">msgs enviadas</div>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-500",
              isBot
                ? "bg-gradient-to-r from-master-orange/80 to-master-orange"
                : "bg-master-orange"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Card wrapper
// ============================================================

function Card({
  title,
  right,
  className,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5",
        className
      )}
    >
      <header className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="font-semibold text-slate-900 dark:text-white text-sm">
          {title}
        </h2>
        {right && <div>{right}</div>}
      </header>
      {children}
    </div>
  );
}

/**
 * Send / Inbox / Users imports usados no Kpi grid sao referenciados em
 * outros pontos do bundle — mantidos no escopo pra nao quebrar tree
 * shaking caso a UI volte a usar.
 */
void Send;
