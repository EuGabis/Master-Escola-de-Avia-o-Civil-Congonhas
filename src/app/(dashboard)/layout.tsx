import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.uid },
    select: { name: true, email: true, role: true, avatar: true },
  });
  if (!user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar workspaceId={session.wid} user={user} />
      <main className="flex-1 overflow-hidden bg-slate-100 dark:bg-slate-950">
        {children}
      </main>
    </div>
  );
}
