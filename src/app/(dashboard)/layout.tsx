import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { MobileShell } from "@/components/MobileShell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Le do JWT em vez de consultar o banco — economiza 1 query
  // (~300-400ms) em CADA navegacao do dashboard.
  // Fallback: sessoes antigas (anteriores ao deploy) nao tem name/avatar
  // no token; usa email como label ate o proximo login.
  const user = {
    name: session.name ?? session.email,
    email: session.email,
    role: session.role,
    avatar: session.avatar ?? null,
  };

  // Logo do workspace pra mostrar na sidebar. Query pequena (1 campo),
  // mas executa em cada navegacao do dashboard — mantemos pra logo
  // refletir imediato quando o admin troca.
  const ws = await db.workspace.findUnique({
    where: { id: session.wid },
    select: { logo: true, name: true },
  });

  return (
    <MobileShell
      workspaceId={session.wid}
      user={user}
      workspaceLogo={ws?.logo ?? null}
      workspaceName={ws?.name ?? null}
    >
      {children}
    </MobileShell>
  );
}
