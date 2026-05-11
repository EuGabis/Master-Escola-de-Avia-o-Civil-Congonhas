import { Users } from "lucide-react";
import { PageHeader, ComingSoon } from "@/components/PageHeader";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ContatosPage() {
  const session = await getSession();
  if (!session) return null;

  const contacts = await db.contact.findMany({
    where: { workspaceId: session.wid },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <PageHeader
          title="Contatos"
          description={`${contacts.length} contatos cadastrados (mostrando os 20 mais recentes)`}
        />

        {contacts.length === 0 ? (
          <ComingSoon
            icon={Users}
            title="Sem contatos ainda"
            description="Conforme mensagens forem chegando pelo WhatsApp, contatos serao criados automaticamente."
          />
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="grid grid-cols-12 gap-3 px-5 py-3 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:border-slate-800 font-medium">
              <div className="col-span-5">Nome</div>
              <div className="col-span-4">Telefone</div>
              <div className="col-span-3">Cadastro</div>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-12 gap-3 px-5 py-3 items-center hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                >
                  <div className="col-span-5 flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-master-orange/10 text-master-orange flex items-center justify-center text-sm font-bold shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-slate-900 dark:text-white truncate">
                      {c.name}
                    </span>
                  </div>
                  <div className="col-span-4 text-sm text-slate-500">
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
