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
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const user = await db.user.findUnique({
    where: { id: session.uid },
    select: { name: true },
  });

  const [
    conversations,
    openConversations,
    contacts,
    msgsTotal,
    msgs24h,
    msgs7d,
    msgsIn24h,
    msgsOut24h,
    lastConvs,
  ] = await Promise.all([
    db.conversation.count({ where: { workspaceId: session.wid } }),
    db.conversation.count({ where: { workspaceId: session.wid, status: "open" } }),
    db.contact.count({ where: { workspaceId: session.wid } }),
    db.message.count({ where: { conversation: { workspaceId: session.wid } } }),
    db.message.count({
      where: {
        conversation: { workspaceId: session.wid },
        timestamp: { gte: since24h },
      },
    }),
    db.message.count({
      where: {
        conversation: { workspaceId: session.wid },
        timestamp: { gte: since7d },
      },
    }),
    db.message.count({
      where: {
        conversation: { workspaceId: session.wid },
        direction: "in",
        timestamp: { gte: since24h },
      },
    }),
    db.message.count({
      where: {
        conversation: { workspaceId: session.wid },
        direction: "out",
        timestamp: { gte: since24h },
      },
    }),
    db.conversation.findMany({
      where: { workspaceId: session.wid },
      orderBy: { lastMessageAt: "desc" },
      take: 8,
      include: { contact: { select: { name: true, phone: true } } },
    }),
  ]);

  // Heatmap simples por dia da semana (ultimos 7 dias)
  const msgsByDay: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(now.getDate() - i);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    const c = await db.message.count({
      where: {
        conversation: { workspaceId: session.wid },
        timestamp: { gte: start, lte: end },
      },
    });
    msgsByDay.push(c);
  }
  const maxDay = Math.max(1, ...msgsByDay);

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      {/* HEADER COMPACTO */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="px-6 lg:px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">
              Ola, {user?.name?.split(" ")[0]}
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
      <div className="px-6 lg:px-8 py-6 space-y-6 max-w-[1400px] mx-auto">
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
      className={`rounded-xl border p-4 ${
        accent
          ? "border-master-orange/30 bg-master-orange/5 dark:bg-master-orange/10"
          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            {label}
          </div>
          <div className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white mt-1 leading-none">
            {value.toLocaleString("pt-BR")}
          </div>
          <div className="text-xs text-slate-500 mt-1.5 truncate">{sub}</div>
        </div>
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            accent
              ? "bg-master-orange text-white"
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
