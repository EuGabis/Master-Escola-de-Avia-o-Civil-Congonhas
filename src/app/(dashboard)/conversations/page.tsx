import { getSession } from "@/lib/auth/session";
import ConversationsClient from "./ConversationsClient";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  const session = await getSession();
  if (!session) return null;
  return <ConversationsClient workspaceId={session.wid} />;
}
