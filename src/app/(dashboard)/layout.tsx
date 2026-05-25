import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
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

  return (
    <MobileShell workspaceId={session.wid} user={user}>
      {children}
    </MobileShell>
  );
}
