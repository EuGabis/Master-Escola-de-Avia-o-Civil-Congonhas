import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { pusher } from "@/lib/pusher";

/**
 * Endpoint chamado pelo cliente Pusher antes de se inscrever em canal privado.
 * Verificamos:
 *   1. Usuario logado
 *   2. O canal pertence ao workspace dele (ou ao proprio user)
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const formData = await req.formData();
  const socketId = formData.get("socket_id") as string;
  const channel = formData.get("channel_name") as string;

  if (!socketId || !channel) {
    return new NextResponse("Bad request", { status: 400 });
  }

  // Autorizacao por padrao de nome de canal
  let allowed = false;
  if (channel === `private-workspace-${session.wid}`) {
    allowed = true;
  } else if (channel === `private-user-${session.uid}`) {
    allowed = true;
  } else if (channel.startsWith("private-conversation-")) {
    // Conversas: validamos que pertence ao workspace
    const conversationId = channel.replace("private-conversation-", "");
    const { db } = await import("@/lib/db");
    const conv = await db.conversation.findUnique({
      where: { id: conversationId },
      select: { workspaceId: true },
    });
    allowed = conv?.workspaceId === session.wid;
  }

  if (!allowed) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const authResponse = pusher.authorizeChannel(socketId, channel);
  return NextResponse.json(authResponse);
}
