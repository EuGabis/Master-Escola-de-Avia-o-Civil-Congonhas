import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await db.followUp.findMany({
    where: { workspaceId: session.wid },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ items });
}

const createSchema = z.object({
  name: z.string().min(1).max(80),
  enabled: z.boolean().default(true),
  inactivityHours: z.number().int().min(1).max(720), // max 30 dias
  message: z.string().min(1).max(2000),
  maxTimes: z.number().int().min(1).max(10).default(1),
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

  const item = await db.followUp.create({
    data: {
      workspaceId: session.wid,
      name: body.name.trim(),
      enabled: body.enabled,
      triggerType: "inactivity",
      inactivityHours: body.inactivityHours,
      message: body.message.trim(),
      maxTimes: body.maxTimes,
    },
  });

  return NextResponse.json({ item });
}
