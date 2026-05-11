import { getSession } from "@/lib/auth/session";
import InboxClient from "./InboxClient";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const session = await getSession();
  if (!session) return null;
  return <InboxClient workspaceId={session.wid} userName={session.email} />;
}
