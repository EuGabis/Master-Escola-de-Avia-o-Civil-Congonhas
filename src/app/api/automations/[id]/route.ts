import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  enabled: z.boolean().optional(),
  triggerType: z.enum(["keyword", "first_message"]).optional(),
  keywords: z.string().max(500).nullable().optional(),
  assignUserId: z.string().nullable().optional(),
  pipelineColumnId: z.string().nullable().optional(),
  addLabelName: z.string().max(40).nullable().optional(),
});

async function ensureOwn(id: string, workspaceId: string) {
  return db.automation.findFirst({
    where: { id, workspaceId },
    select: { id: true },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await ensureOwn(id, session.wid)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }

  const auto = await db.automation.update({ where: { id }, data: body });
  return NextResponse.json({ automation: auto });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await ensureOwn(id, session.wid)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.automation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
