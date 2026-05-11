import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const labels = await db.label.findMany({
    where: { workspaceId: session.wid },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ labels });
}

const createSchema = z.object({
  name: z.string().min(1).max(40).trim(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
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

  try {
    const label = await db.label.create({
      data: {
        workspaceId: session.wid,
        name: body.name,
        color: body.color ?? "#6366f1",
      },
    });
    return NextResponse.json({ label });
  } catch {
    return NextResponse.json(
      { error: "Etiqueta com esse nome ja existe" },
      { status: 409 }
    );
  }
}
