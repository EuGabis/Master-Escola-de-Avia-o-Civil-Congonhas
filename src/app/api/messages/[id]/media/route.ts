import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/messages/[id]/media
 *
 * Retorna apenas a base64 de uma mensagem especifica.
 * Usado pelo MessageMedia component pra lazy-load: o /messages
 * lista nao traz mediaBase64 (pesado), so quando a UI vai renderizar
 * o player/preview eh que busca aqui.
 *
 * Cache forte: a midia eh imutavel apos salva.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const message = await db.message.findFirst({
    where: {
      id,
      conversation: { workspaceId: session.wid },
    },
    select: {
      type: true,
      mediaBase64: true,
      mediaUrl: true,
      fileName: true,
    },
  });

  if (!message)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(
    {
      mediaBase64: message.mediaBase64,
      mediaUrl: message.mediaUrl,
      fileName: message.fileName,
      type: message.type,
    },
    {
      // Mensagens nao mudam apos criadas - cache agressivo
      headers: {
        "Cache-Control": "private, max-age=3600, immutable",
      },
    }
  );
}
