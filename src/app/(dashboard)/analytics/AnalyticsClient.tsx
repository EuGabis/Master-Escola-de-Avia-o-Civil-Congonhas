"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Send, Inbox, Users, MessageSquare } from "lucide-react";
import { cn } from "@/lib/cn";

interface Data {
  summary: {
    totalConversations: number;
    openConversations: number;
    totalContacts: number;
    contacts30d: number;
    totalMessages: number;
    messages30d: number;
    msgsIn30d: number;
    msgsOut30d: number;
  };
  msgsByDay: { date: string; count: number }[];
  msgsByHour: number[];
  topContacts: { conversationId: string; name: string; count: number }[];
  statusBreakdown: { open: number; pending: number; resolved: number };
}

export default function AnalyticsClient() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    void fetch("/api/analytics")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) {
    return (
      <div className="p-8">
        <p className="text-sm text-slate-500">Carregando metricas...</p>
      </div>
    );
  }

  const maxDay = Math.max(1, ...data.msgsByDay.map((d) => d.count));
  const maxHour = Math.max(1, ...data.msgsByHour);
  const totalStatus =
    data.statusBreakdown.open +
    data.statusBreakdown.pending +
    data.statusBreakdown.resolved;

  const conversionRate =
    totalStatus > 0
      ? ((data.statusBreakdown.resolved / totalStatus) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 lg:px-8 py-5">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          Analytics
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Metricas dos ultimos 30 dias
        </p>
      </header>

      <div className="px-6 lg:px-8 py-6 max-w-[1400px] mx-auto space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi
            label="Conversas (30d)"
            value={data.summary.totalConversations}
            icon={MessageSquare}
          />
          <Kpi
            label="Em aberto agora"
            value={data.summary.openConversations}
            icon={Inbox}
            accent
          />
          <Kpi
            label="Novos contatos"
            value={data.summary.contacts30d}
            icon={Users}
            sub="nos ultimos 30 dias"
          />
          <Kpi
            label="Taxa de resolucao"
            value={`${conversionRate}%`}
            icon={TrendingUp}
            sub={`${data.statusBreakdown.resolved} resolvidas`}
          />
        </div>

        {/* Mensagens 30d */}
        <Card title="Mensagens nos ultimos 30 dias" right={`${data.summary.messages30d} total`}>
          <div className="flex items-end gap-1 h-48">
            {data.msgsByDay.map((d, i) => {
              const h = (d.count / maxDay) * 100;
              const isToday = i === data.msgsByDay.length - 1;
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
                  <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300 opacity-0 group-hover:opacity-100 transition">
                    {d.count}
                  </span>
                  <div className="w-full flex-1 flex items-end">
                    <div
                      style={{ height: `${Math.max(2, h)}%` }}
                      className={cn(
                        "w-full rounded-t transition",
                        isToday ? "bg-master-orange" : "bg-slate-200 dark:bg-slate-700 group-hover:bg-master-orange/60"
                      )}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-2">
            <span>{new Date(data.msgsByDay[0]!.date).toLocaleDateString("pt-BR")}</span>
            <span>Hoje</span>
          </div>
        </Card>

        {/* In vs Out + Hora do dia */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* In vs Out */}
          <Card title="Recebidas vs Enviadas (30d)" className="lg:col-span-1">
            <div className="space-y-4 py-2">
              <Bar
                label="Recebidas"
                value={data.summary.msgsIn30d}
                total={data.summary.messages30d}
                color="bg-emerald-500"
                icon={Inbox}
              />
              <Bar
                label="Enviadas"
                value={data.summary.msgsOut30d}
                total={data.summary.messages30d}
                color="bg-master-orange"
                icon={Send}
              />
            </div>
          </Card>

          {/* Hora do dia */}
          <Card title="Mensagens por hora (7 dias)" className="lg:col-span-2">
            <div className="flex items-end gap-1 h-32">
              {data.msgsByHour.map((c, h) => {
                const ph = (c / maxHour) * 100;
                return (
                  <div key={h} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="w-full flex-1 flex items-end">
                      <div
                        style={{ height: `${Math.max(2, ph)}%` }}
                        className="w-full rounded-t bg-master-orange/30 group-hover:bg-master-orange transition"
                        title={`${h}h: ${c} msgs`}
                      />
                    </div>
                    <span className="text-[9px] text-slate-400">{h}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-500 mt-1 text-center">
              Eixo horizontal: hora do dia (0-23)
            </p>
          </Card>
        </div>

        {/* Top contatos + Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card title="Top conversas (30d)" className="lg:col-span-2">
            {data.topContacts.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">Sem dados</p>
            ) : (
              <div className="space-y-3">
                {data.topContacts.map((c, idx) => {
                  const maxCount = data.topContacts[0]!.count;
                  return (
                    <div key={c.conversationId} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-400 w-4">
                        {idx + 1}.
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {c.name}
                          </span>
                          <span className="text-xs text-slate-500 shrink-0 ml-2">
                            {c.count} msgs
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className="h-full bg-master-orange"
                            style={{ width: `${(c.count / maxCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title="Status das conversas">
            <div className="space-y-3 py-2">
              <StatusBar
                label="Aberta"
                value={data.statusBreakdown.open}
                total={totalStatus}
                color="bg-emerald-500"
              />
              <StatusBar
                label="Pendente"
                value={data.statusBreakdown.pending}
                total={totalStatus}
                color="bg-amber-500"
              />
              <StatusBar
                label="Resolvida"
                value={data.statusBreakdown.resolved}
                total={totalStatus}
                color="bg-slate-400"
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  accent,
  sub,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent?: boolean;
  sub?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 flex items-start justify-between",
        accent
          ? "border-master-orange/30 bg-master-orange/5 dark:bg-master-orange/10"
          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
      )}
    >
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          {label}
        </div>
        <div className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white mt-1 leading-none">
          {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
        </div>
        {sub && <div className="text-[10px] text-slate-500 mt-1.5">{sub}</div>}
      </div>
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
          accent
            ? "bg-master-orange text-white"
            : "bg-slate-100 dark:bg-slate-800 text-slate-500"
        )}
      >
        <Icon size={16} />
      </div>
    </div>
  );
}

function Card({
  title,
  right,
  className,
  children,
}: {
  title: string;
  right?: string;
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
      <header className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900 dark:text-white text-sm">
          {title}
        </h2>
        {right && (
          <span className="text-xs text-master-orange font-medium">
            {right}
          </span>
        )}
      </header>
      {children}
    </div>
  );
}

function Bar({
  label,
  value,
  total,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200">
          <Icon size={12} /> {label}
        </span>
        <span className="text-sm font-semibold text-slate-900 dark:text-white">
          {value.toLocaleString("pt-BR")}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div className={cn("h-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[10px] text-slate-400 mt-0.5">{pct.toFixed(1)}%</div>
    </div>
  );
}

function StatusBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-slate-700 dark:text-slate-200">{label}</span>
        <span className="text-sm font-semibold text-slate-900 dark:text-white">
          {value}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div className={cn("h-full", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
