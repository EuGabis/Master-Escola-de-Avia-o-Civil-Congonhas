import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  MessagesSquare,
  Users,
  Inbox,
  ArrowRight,
  TrendingUp,
  Send,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [conversations, openConversations, contacts, messages, msgs24h, lastConvs] =
    await Promise.all([
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
      db.conversation.findMany({
        where: { workspaceId: session.wid },
        orderBy: { lastMessageAt: "desc" },
        take: 6,
        include: { contact: { select: { name: true, phone: true } } },
      }),
    ]);

  return (
    <div className="h-full overflow-y-auto">
      {/* HERO */}
      <div className="gradient-master px-6 lg:px-10 pt-10 pb-20 relative overflow-hidden">
        <div className="max-w-6xl mx-auto relative">
          <p className="text-master-orange-100 text-sm font-medium uppercase tracking-wider">
            Visao geral
          </p>
          <h1 className="text-3xl lg:text-4xl font-bold text-white mt-1">
            Bom trabalho hoje
          </h1>
          <p className="text-master-orange-50 mt-2 max-w-md">
            Acompanhe o atendimento do WhatsApp em tempo real, gerencie leads e
            converta mais matriculas.
          </p>
        </div>
      </div>

      {/* STATS - sobrepostas ao hero */}
      <div className="max-w-6xl mx-auto px-6 lg:px-10 -mt-12 relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <StatCard
            label="Conversas"
            value={conversations}
            icon={MessagesSquare}
          />
          <StatCard label="Em aberto" value={openConversations} icon={Inbox} accent />
          <StatCard label="Contatos" value={contacts} icon={Users} />
          <StatCard label="Msgs (24h)" value={msgs24h} icon={Send} trend />
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ultimas conversas */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <header className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Conversas recentes
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">As 6 mais recentes</p>
            </div>
            <Link
              href="/conversations"
              className="text-sm text-master-orange hover:underline flex items-center gap-1 font-medium"
            >
              Ver todas <ArrowRight size={14} />
            </Link>
          </header>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {lastConvs.length === 0 ? (
              <p className="p-12 text-center text-sm text-slate-500">
                Nenhuma conversa ainda. Aguardando mensagens chegarem...
              </p>
            ) : (
              lastConvs.map((c) => (
                <Link
                  key={c.id}
                  href={`/conversations?id=${c.id}`}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-master-orange to-master-orange-700 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-sm">
                      {c.contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-white truncate group-hover:text-master-orange transition">
                        {c.contact.name}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {c.lastMessage ?? "—"}
                      </div>
                    </div>
                  </div>
                  {c.unreadCount > 0 && (
                    <span className="bg-master-orange text-white text-xs font-bold rounded-full px-2 py-0.5 ml-3 shrink-0">
                      {c.unreadCount}
                    </span>
                  )}
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Atalhos */}
        <aside className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm uppercase tracking-wider mb-3">
              Atalhos
            </h3>
            <div className="space-y-2">
              <Shortcut href="/conversations" label="Inbox de atendimento" />
              <Shortcut href="/contatos" label="Ver contatos" />
              <Shortcut href="/configuracoes" label="Configuracoes" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-master-navy to-master-navy-800 rounded-2xl p-5 text-white">
            <TrendingUp size={20} className="text-master-orange mb-2" />
            <h3 className="font-bold text-lg leading-tight">
              Pipeline em breve
            </h3>
            <p className="text-master-navy-200 text-sm mt-2">
              Funil visual estilo Kanban com etapas customizaveis para
              acompanhar matriculas.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  trend,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent?: boolean;
  trend?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 flex items-start justify-between shadow-sm transition hover:-translate-y-0.5 ${
        accent
          ? "bg-master-orange text-white shadow-lg shadow-master-orange/20"
          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
      }`}
    >
      <div>
        <div
          className={`text-2xl lg:text-3xl font-bold ${
            accent ? "text-white" : "text-master-navy dark:text-white"
          }`}
        >
          {value.toLocaleString("pt-BR")}
        </div>
        <div
          className={`text-[10px] lg:text-xs uppercase tracking-wider mt-1 font-medium ${
            accent ? "text-master-orange-50" : "text-slate-500"
          }`}
        >
          {label}
        </div>
      </div>
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          accent
            ? "bg-white/15 text-white"
            : trend
              ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
              : "bg-master-orange/10 text-master-orange"
        }`}
      >
        <Icon size={18} />
      </div>
    </div>
  );
}

function Shortcut({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-master-orange transition group"
    >
      <span>{label}</span>
      <ArrowRight
        size={14}
        className="text-slate-400 group-hover:text-master-orange group-hover:translate-x-0.5 transition"
      />
    </Link>
  );
}
