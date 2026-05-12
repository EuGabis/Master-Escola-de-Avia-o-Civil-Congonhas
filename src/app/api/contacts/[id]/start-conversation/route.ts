import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

/**
 * POST /api/contacts/[id]/start-conversation
 *
 * Cria (ou retorna) uma conversa aberta com esse contato.
 * Util pra abrir chat direto da pagina de contatos sem o cliente
 * ter mandado mensagem primeiro.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const contact = await db.contact.findFirst({
    where: { id, workspaceId: session.wid },
    select: { id: true },
  });
  if (!contact)
    return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });

  // Procura conversa existente
  let conv = await db.conversation.findFirst({
    where: { workspaceId: session.wid, contactId: contact.id },
    select: { id: true, status: true },
  });
  if (!conv) {
    conv = await db.conversation.create({
      data: {
        workspaceId: session.wid,
        contactId: contact.id,
        status: "open",
        channel: "whatsapp",
      },
      select: { id: true, status: true },
    });
  }

  return NextResponse.json({ conversationId: conv.id });
}
