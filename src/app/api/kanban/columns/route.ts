import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

const createSchema = z.object({
  name: z.string().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  wipLimit: z.number().int().positive().nullable().optional(),
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

  const lastOrder = await db.kanbanColumn.findFirst({
    where: { workspaceId: session.wid },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const col = await db.kanbanColumn.create({
    data: {
      workspaceId: session.wid,
      name: body.name,
      color: body.color ?? "#94a3b8",
      wipLimit: body.wipLimit ?? null,
      order: (lastOrder?.order ?? -1) + 1,
    },
  });

  return NextResponse.json({ column: col });
}
