import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { MessagesSquare, Users, Inbox, ArrowRight } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const [conversations, openConversations, contacts, messages, lastConvs] =
    await Promise.all([
      db.conversation.count({ where: { workspaceId: session.wid } }),
      db.conversation.count({
        where: { workspaceId: session.wid, status: "open" },
      }),
      db.contact.count({ where: { workspaceId: session.wid } }),
      db.message.count({
        where: { conversation: { workspaceId: session.wid } },
      }),
      db.conversation.findMany({
        where: { workspaceId: session.wid },
        orderBy: { lastMessageAt: "desc" },
        take: 5,
        include: { contact: { select: { name: true, phone: true } } },
      }),
    ]);

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Hero */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Visao geral do atendimento
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Conversas totais"
            value={conversations}
            icon={MessagesSquare}
          />
          <StatCard
            label="Em aberto"
            value={openConversations}
            icon={Inbox}
            accent
          />
          <StatCard label="Contatos" value={contacts} icon={Users} />
          <StatCard label="Mensagens" value={messages} icon={MessagesSquare} />
        </div>

        {/* Ultimas conversas */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Ultimas conversas
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                As 5 mais recentes
              </p>
            </div>
            <Link
              href="/conversations"
              className="text-sm text-master-orange hover:underline flex items-center gap-1 font-medium"
            >
              Ver todas <ArrowRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {lastConvs.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">
                Nenhuma conversa ainda. Aguardando mensagens chegarem...
              </p>
            ) : (
              lastConvs.map((c) => (
                <Link
                  key={c.id}
                  href={`/conversations?id=${c.id}`}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-master-orange/10 text-master-orange flex items-center justify-center text-sm font-bold shrink-0">
                      {c.contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-white truncate">
                        {c.contact.name}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {c.lastMessage ?? "—"}
                      </div>
                    </div>
                  </div>
                  {c.unreadCount > 0 && (
                    <span className="bg-master-orange text-white text-xs rounded-full px-2 py-0.5 ml-3 shrink-0">
                      {c.unreadCount}
                    </span>
                  )}
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 flex items-start justify-between ${
        accent
          ? "bg-master-orange text-white shadow-lg shadow-master-orange/20"
          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
      }`}
    >
      <div>
        <div
          className={`text-3xl font-bold ${
            accent ? "text-white" : "text-master-navy dark:text-white"
          }`}
        >
          {value.toLocaleString("pt-BR")}
        </div>
        <div
          className={`text-xs uppercase tracking-wider mt-1 ${
            accent ? "text-master-orange-50" : "text-slate-500"
          }`}
        >
          {label}
        </div>
      </div>
      <Icon
        size={20}
        className={accent ? "text-master-orange-100" : "text-slate-300"}
      />
    </div>
  );
}
