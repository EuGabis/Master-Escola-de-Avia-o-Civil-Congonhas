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
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const start7d = new Date(now);
  start7d.setDate(now.getDate() - 6);
  start7d.setHours(0, 0, 0, 0);

  // Tudo em paralelo. Os 5 counts de Message viraram 1 raw query
  // (msgStats) e os 7 dias do chart viraram 1 raw (dayStats), em vez
  // de 5 count() separados com JOIN em Message.
  const [convStats, contacts, msgStats, dayStats, lastConvs] = await Promise.all([
    db.$queryRaw<{ total: bigint; open: bigint }[]>`
      SELECT
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE status = 'open')::bigint AS open
      FROM "Conversation"
      WHERE "workspaceId" = ${session.wid}
    `,
    db.contact.count({ where: { workspaceId: session.wid } }),
    db.$queryRaw<
      {
        total: bigint;
        h24: bigint;
        h24_in: bigint;
        h24_out: bigint;
        d7: bigint;
      }[]
    >`
      SELECT
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE m."timestamp" >= ${since24h})::bigint AS h24,
        COUNT(*) FILTER (WHERE m."timestamp" >= ${since24h} AND m.direction = 'in')::bigint AS h24_in,
        COUNT(*) FILTER (WHERE m."timestamp" >= ${since24h} AND m.direction = 'out')::bigint AS h24_out,
        COUNT(*) FILTER (WHERE m."timestamp" >= ${start7d})::bigint AS d7
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
        unreadCount: true,
        contact: { select: { name: true, phone: true } },
      },
    }),
  ]);

  const conversations = Number(convStats[0]?.total ?? 0);
  const openConversations = Number(convStats[0]?.open ?? 0);
  const msgsTotal = Number(msgStats[0]?.total ?? 0);
  const msgs24h = Number(msgStats[0]?.h24 ?? 0);
  const msgsIn24h = Number(msgStats[0]?.h24_in ?? 0);
  const msgsOut24h = Number(msgStats[0]?.h24_out ?? 0);
  const msgs7d = Number(msgStats[0]?.d7 ?? 0);
  const userName = session.name ?? session.email;

  const raw = dayStats;
  const dayMap = new Map<string, number>();
  for (const r of raw) {
    dayMap.set(r.day.toISOString().slice(0, 10), Number(r.count));
  }
  const msgsByDay: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    msgsByDay.push(dayMap.get(d.toISOString().slice(0, 10)) ?? 0);
  }
  const maxDay = Math.max(1, ...msgsByDay);

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      {/* HEADER COMPACTO */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">
              Olá, {userName.split(" ")[0]}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {now.toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
          <Link
            href="/conversations"
            className="hidden sm:flex items-center gap-2 rounded-lg bg-master-orange hover:bg-master-orange-600 text-white text-sm font-medium px-4 py-2 transition shadow-sm"
          >
            <Inbox size={16} />
            Abrir Inbox
          </Link>
        </div>
      </div>

      {/* CONTEUDO */}
      <div className="px-6 lg:px-8 py-6 space-y-6 max-w-5xl mx-auto">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi
            label="Em aberto"
            value={openConversations}
            sub={`de ${conversations} conversas`}
            icon={Inbox}
            accent
          />
          <Kpi
            label="Contatos"
            value={contacts}
            sub="cadastrados"
            icon={Users}
          />
          <Kpi
            label="Msgs 24h"
            value={msgs24h}
            sub={`${msgsIn24h} in · ${msgsOut24h} out`}
            icon={Send}
          />
          <Kpi
            label="Msgs 7 dias"
            value={msgs7d}
            sub={`${msgsTotal} total`}
            icon={Activity}
          />
        </div>

        {/* CHART + RECENTES */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Mini chart por dia */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
            <header className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white text-sm">
                  Mensagens nos ultimos 7 dias
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Volume diario consolidado
                </p>
              </div>
              <span className="text-xs uppercase tracking-wider bg-master-orange/10 text-master-orange px-2 py-1 rounded font-medium">
                {msgs7d} total
              </span>
            </header>
            <div className="flex items-end gap-2 h-40">
              {msgsByDay.map((count, i) => {
                const d = new Date(now);
                d.setDate(now.getDate() - (6 - i));
                const height = (count / maxDay) * 100;
                const isToday = i === 6;
                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center gap-2 group"
                  >
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 opacity-0 group-hover:opacity-100 transition">
                      {count}
                    </span>
                    <div className="w-full flex-1 flex items-end">
                      <div
                        style={{ height: `${Math.max(2, height)}%` }}
                        className={`w-full rounded-t transition ${
                          isToday
                            ? "bg-master-orange"
                            : "bg-slate-200 dark:bg-slate-700 group-hover:bg-master-orange/50"
                        }`}
                      />
                    </div>
                    <span className="text-[10px] uppercase text-slate-500">
                      {d.toLocaleDateString("pt-BR", { weekday: "short" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Conversas recentes (lateral) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
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
                <p className="p-6 text-center text-xs text-slate-500">
                  Aguardando primeiras mensagens...
                </p>
              ) : (
                lastConvs.slice(0, 8).map((c) => (
                  <Link
                    key={c.id}
                    href={`/conversations?id=${c.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                  >
                    <div className="w-8 h-8 rounded-full bg-master-orange/10 text-master-orange flex items-center justify-center text-xs font-bold shrink-0">
                      {c.contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {c.contact.name}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {c.lastMessage ?? "—"}
                      </div>
                    </div>
                    {c.unreadCount > 0 && (
                      <span className="bg-master-orange text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 ml-1 min-w-[18px] text-center shrink-0">
                        {c.unreadCount}
                      </span>
                    )}
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* INFO ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoCard
            icon={Clock}
            label="Tempo medio de resposta"
            value="—"
            hint="Disponivel em breve"
          />
          <InfoCard
            icon={MessagesSquare}
            label="Taxa de resposta"
            value="—"
            hint="Disponivel em breve"
          />
          <InfoCard
            icon={Users}
            label="Conversoes 30d"
            value="—"
            hint="Disponivel em breve"
          />
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  sub: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent?: boolean;
}) {
  return (
    <div
      className={`group rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 ${
        accent
          ? "border-master-orange/30 bg-master-orange/5 dark:bg-master-orange/10 hover:shadow-lg hover:shadow-master-orange/15"
          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold">
            {label}
          </div>
          <div className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white mt-1.5 leading-none tabular-nums">
            {value.toLocaleString("pt-BR")}
          </div>
          <div className="text-xs text-slate-500 mt-2 truncate">{sub}</div>
        </div>
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${
            accent
              ? "bg-master-orange text-white shadow-md shadow-master-orange/30"
              : "bg-slate-100 dark:bg-slate-800 text-slate-500"
          }`}
        >
          <Icon size={16} />
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center shrink-0">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-lg font-bold text-slate-900 dark:text-white">
          {value}
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5">{hint}</div>
      </div>
    </div>
  );
}
