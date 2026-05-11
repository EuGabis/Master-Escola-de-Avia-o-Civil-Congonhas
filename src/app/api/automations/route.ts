import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const automations = await db.automation.findMany({
    where: { workspaceId: session.wid },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ automations });
}

const createSchema = z.object({
  name: z.string().min(1).max(80),
  enabled: z.boolean().default(true),
  triggerType: z.enum(["keyword", "first_message"]),
  keywords: z.string().max(500).nullable().optional(),
  assignUserId: z.string().nullable().optional(),
  pipelineColumnId: z.string().nullable().optional(),
  addLabelName: z.string().max(40).nullable().optional(),
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

  if (body.triggerType === "keyword" && !body.keywords?.trim()) {
    return NextResponse.json(
      { error: "Defina ao menos uma palavra-chave (separe por virgula)" },
      { status: 400 }
    );
  }

  const auto = await db.automation.create({
    data: {
      workspaceId: session.wid,
      name: body.name.trim(),
      enabled: body.enabled,
      triggerType: body.triggerType,
      keywords: body.keywords?.trim() || null,
      assignUserId: body.assignUserId || null,
      pipelineColumnId: body.pipelineColumnId || null,
      addLabelName: body.addLabelName?.trim() || null,
    },
  });
  return NextResponse.json({ automation: auto });
}
