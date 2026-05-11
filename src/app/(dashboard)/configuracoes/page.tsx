import { Settings, ShieldCheck, Bot, Webhook } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { AgentConfigForm } from "@/components/AgentConfigForm";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const session = await getSession();
  if (!session) return null;

  const workspace = await db.workspace.findUnique({
    where: { id: session.wid },
    select: {
      name: true,
      slug: true,
      evolutionInstance: true,
      evolutionUrl: true,
      plan: true,
    },
  });

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <PageHeader
          title="Configuracoes"
          description="Workspace, integracoes e seguranca"
        />

        <Card icon={Settings} title="Workspace">
          <Field label="Nome" value={workspace?.name} />
          <Field label="Slug" value={workspace?.slug} />
          <Field label="Plano" value={workspace?.plan} />
        </Card>

        <Card icon={Webhook} title="Evolution API (WhatsApp)">
          <Field label="Instancia" value={workspace?.evolutionInstance} />
          <Field label="URL" value={workspace?.evolutionUrl} mono />
        </Card>

        <Card icon={Bot} title="Agente IA (Claude)">
          <AgentConfigForm />
        </Card>

        <Card icon={ShieldCheck} title="Seguranca">
          <p className="text-sm text-slate-500">
            Senhas com hash bcrypt 12 rounds. Sessao JWT em cookie
            httpOnly+SameSite=Lax+Secure. Rate limit Redis por IP+email. Audit
            log de todas acoes sensiveis.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  badge,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-master-orange" />
          <h2 className="font-semibold text-slate-900 dark:text-white text-sm uppercase tracking-wider">
            {title}
          </h2>
        </div>
        {badge && (
          <span className="text-[10px] uppercase tracking-wider bg-master-orange/10 text-master-orange px-2 py-0.5 rounded-full font-medium">
            {badge}
          </span>
        )}
      </div>
      <div className="p-5 space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between items-center gap-4 py-1 border-b border-slate-50 dark:border-slate-800/40 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span
        className={`text-sm text-slate-900 dark:text-white truncate ${
          mono ? "font-mono text-xs" : "font-medium"
        }`}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}
