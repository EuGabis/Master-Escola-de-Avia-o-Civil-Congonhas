import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth/audit";
import { getClientIp, getUserAgent } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

/**
 * GET /api/contacts?q=...&status=...&courseInterest=...&page=0&limit=50
 * Lista paginada com filtros e busca.
 *
 * POST /api/contacts -> cria contato manualmente
 */

const STATUS = ["lead", "aluno", "ex_aluno", "perdido"] as const;
const COURSES = ["PP", "PC", "Comissario", "INVA", "outro"] as const;
const SOURCES = ["website", "indicacao", "instagram", "google", "outro"] as const;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const status = url.searchParams.get("status");
  const courseInterest = url.searchParams.get("courseInterest");
  const hasConversation = url.searchParams.get("hasConversation");
  const page = Math.max(0, parseInt(url.searchParams.get("page") ?? "0", 10));
  const limit = Math.min(
    100,
    Math.max(10, parseInt(url.searchParams.get("limit") ?? "30", 10))
  );

  const where: Record<string, unknown> = { workspaceId: session.wid };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  if (status && (STATUS as readonly string[]).includes(status)) {
    where.status = status;
  }
  if (courseInterest && (COURSES as readonly string[]).includes(courseInterest)) {
    where.courseInterest = courseInterest;
  }
  if (hasConversation === "yes") {
    where.conversations = { some: {} };
  } else if (hasConversation === "no") {
    where.conversations = { none: {} };
  }

  const [items, total] = await Promise.all([
    db.contact.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: page * limit,
      take: limit,
      include: {
        _count: { select: { conversations: true } },
      },
    }),
    db.contact.count({ where }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  phone: z.string().min(8).max(20).regex(/^\d+$/, "Telefone deve ter só números (com DDI+DDD)"),
  email: z.string().email().nullable().optional().or(z.literal("")),
  notes: z.string().max(5000).optional(),
  courseInterest: z.enum(COURSES).optional(),
  source: z.enum(SOURCES).optional(),
  status: z.enum(STATUS).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await req.json());
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.issues[0]?.message ?? "Dados inválidos"
        : "Dados inválidos";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const contact = await db.contact.create({
      data: {
        workspaceId: session.wid,
        name: body.name,
        phone: body.phone,
        email: body.email || null,
        notes: body.notes || null,
        courseInterest: body.courseInterest || null,
        source: body.source || null,
        status: body.status || "lead",
      },
    });

    await audit({
      workspaceId: session.wid,
      userId: session.uid,
      action: "contact.create",
      target: contact.id,
      meta: { name: contact.name, phone: contact.phone },
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    });

    return NextResponse.json({ contact });
  } catch (err) {
    // Provavelmente unique constraint (phone+workspaceId duplicado)
    if (
      err instanceof Error &&
      err.message.toLowerCase().includes("unique constraint")
    ) {
      return NextResponse.json(
        { error: "Já existe um contato com esse telefone" },
        { status: 409 }
      );
    }
    throw err;
  }
}
