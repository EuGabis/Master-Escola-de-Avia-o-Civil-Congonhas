import { Users } from "lucide-react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ContatosPage() {
  const session = await getSession();
  if (!session) return null;

  const contacts = await db.contact.findMany({
    where: { workspaceId: session.wid },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const total = await db.contact.count({
    where: { workspaceId: session.wid },
  });

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-5xl mx-auto px-6 lg:px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Contatos
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {total} contatos cadastrados
              {total > 50 && " · mostrando os 50 mais recentes"}
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 lg:px-8 py-6">
        {contacts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-master-orange/10 text-master-orange flex items-center justify-center mx-auto mb-3">
              <Users size={24} />
            </div>
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Sem contatos ainda
            </h2>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Conforme mensagens forem chegando pelo WhatsApp, contatos serão
              criados automaticamente.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="grid grid-cols-12 gap-3 px-5 py-3 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:border-slate-800 font-semibold">
              <div className="col-span-6">Contato</div>
              <div className="col-span-3">Telefone</div>
              <div className="col-span-3">Cadastro</div>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-12 gap-3 px-5 py-3 items-center hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                >
                  <div className="col-span-6 flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-master-orange/10 text-master-orange flex items-center justify-center text-sm font-bold shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-white truncate">
                        {c.name}
                      </div>
                      {c.email && (
                        <div className="text-xs text-slate-500 truncate">
                          {c.email}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="col-span-3 text-sm text-slate-500 font-mono">
                    {c.phone}
                  </div>
                  <div className="col-span-3 text-sm text-slate-500">
                    {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
