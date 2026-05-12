import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth/audit";
import { getClientIp, getUserAgent } from "@/lib/auth/request";

const schema = z.object({
  action: z.enum(["delete"]),
  ids: z.array(z.string()).min(1).max(500),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  if (body.action === "delete") {
    const result = await db.contact.deleteMany({
      where: { id: { in: body.ids }, workspaceId: session.wid },
    });
    await audit({
      workspaceId: session.wid,
      userId: session.uid,
      action: "contact.bulk_delete",
      meta: { count: result.count, ids: body.ids.slice(0, 50) },
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    });
    return NextResponse.json({ ok: true, deleted: result.count });
  }

  return NextResponse.json({ error: "Acao desconhecida" }, { status: 400 });
}
