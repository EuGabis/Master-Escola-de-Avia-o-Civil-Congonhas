import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.uid },
    include: { workspace: true },
  });

  const stats = await Promise.all([
    db.conversation.count({ where: { workspaceId: session.wid } }),
    db.conversation.count({
      where: { workspaceId: session.wid, status: "open" },
    }),
    db.contact.count({ where: { workspaceId: session.wid } }),
    db.message.count({
      where: { conversation: { workspaceId: session.wid } },
    }),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header com identidade Master */}
      <header className="bg-master-navy text-white">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Logo variant="white" size="md" />
          <div className="flex items-center gap-4">
            <span className="text-sm text-master-navy-100 hidden sm:inline">
              {user?.email}
            </span>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="rounded-pill bg-white/10 hover:bg-white/20 text-white px-4 py-1.5 text-sm font-medium transition"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          Bem-vindo, {user?.name?.split(" ")[0]}
        </h1>
        <p className="text-slate-500 mt-1">
          Workspace: <span className="font-medium">{user?.workspace.name}</span>{" "}
          · Role: <span className="font-medium">{user?.role}</span>
        </p>

        {/* Cards de estatisticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          <StatCard label="Conversas" value={stats[0]} />
          <StatCard label="Abertas" value={stats[1]} accent />
          <StatCard label="Contatos" value={stats[2]} />
          <StatCard label="Mensagens" value={stats[3]} />
        </div>

        {/* Acoes principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <ActionCard
            href="/inbox"
            title="Inbox de Atendimento"
            description="Conversas do WhatsApp em tempo real"
            cta="Abrir"
            primary
          />
          <ActionCard
            href="#"
            title="Contatos"
            description="Em breve — gerenciar leads, alunos e ex-alunos"
            cta="Em breve"
            disabled
          />
          <ActionCard
            href="#"
            title="Kanban / Funil"
            description="Em breve — pipeline de matricula visual"
            cta="Em breve"
            disabled
          />
          <ActionCard
            href="#"
            title="Automacoes & IA"
            description="Em breve — gatilhos, respostas rapidas e agente IA"
            cta="Em breve"
            disabled
          />
        </div>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 ${
        accent
          ? "bg-master-orange text-white"
          : "bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700"
      }`}
    >
      <div className={`text-3xl font-bold ${accent ? "" : "text-master-navy dark:text-white"}`}>
        {value.toLocaleString("pt-BR")}
      </div>
      <div className={`text-xs uppercase tracking-wider mt-1 ${
        accent ? "text-master-orange-50" : "text-slate-500"
      }`}>
        {label}
      </div>
    </div>
  );
}

function ActionCard({
  href,
  title,
  description,
  cta,
  primary,
  disabled,
}: {
  href: string;
  title: string;
  description: string;
  cta: string;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-6 flex items-center justify-between gap-4">
      <div className="flex-1">
        <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </div>
      <a
        href={disabled ? "#" : href}
        aria-disabled={disabled}
        className={`rounded-pill px-5 py-2 text-sm font-medium transition shrink-0 ${
          disabled
            ? "bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
            : primary
              ? "bg-master-orange hover:bg-master-orange-600 text-white shadow-md"
              : "bg-master-navy hover:bg-master-navy-700 text-white"
        }`}
      >
        {cta}
      </a>
    </div>
  );
}
