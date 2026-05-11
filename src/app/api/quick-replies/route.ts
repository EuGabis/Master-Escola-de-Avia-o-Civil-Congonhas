import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await db.quickReply.findMany({
    where: { workspaceId: session.wid },
    orderBy: { title: "asc" },
  });
  return NextResponse.json({ items });
}

const createSchema = z.object({
  title: z.string().min(1).max(60),
  content: z.string().min(1).max(4000),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }

  const item = await db.quickReply.create({
    data: {
      workspaceId: session.wid,
      title: body.title.trim(),
      content: body.content.trim(),
    },
  });
  return NextResponse.json({ item });
}
