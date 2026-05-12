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

  const user = await db.user.findUnique({
    where: { id: session.uid },
    select: { name: true, email: true, role: true, avatar: true },
  });
  if (!user) redirect("/login");

  return (
    <MobileShell workspaceId={session.wid} user={user}>
      {children}
    </MobileShell>
  );
}
