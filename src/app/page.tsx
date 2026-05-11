import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

// Pagina depende de cookie de sessao - nunca estatica
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.uid },
    include: { workspace: true },
  });

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Master CRM
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Bem-vindo, {user?.name}
          </p>

          <div className="mt-6 space-y-2 text-sm">
            <Row k="Workspace" v={user?.workspace.name ?? "-"} />
            <Row k="Email" v={user?.email ?? "-"} />
            <Row k="Role" v={user?.role ?? "-"} />
          </div>

          <form action="/api/auth/logout" method="POST" className="mt-6">
            <button
              type="submit"
              className="rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 px-4 py-2 text-sm font-medium"
            >
              Sair
            </button>
          </form>

          <p className="text-xs text-slate-400 mt-8">
            Esta tela e provisoria. Modulos do CRM (Inbox, Kanban, etc) serao
            construidos nas proximas etapas.
          </p>
        </div>
      </div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 dark:border-slate-700 py-2">
      <span className="text-slate-500">{k}</span>
      <span className="text-slate-900 dark:text-white font-medium">{v}</span>
    </div>
  );
}
