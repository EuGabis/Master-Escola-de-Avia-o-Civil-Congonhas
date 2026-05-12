import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/contacts/export -> CSV de todos os contatos do workspace
 */
export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contacts = await db.contact.findMany({
    where: { workspaceId: session.wid },
    orderBy: { name: "asc" },
    select: {
      name: true,
      phone: true,
      email: true,
      courseInterest: true,
      source: true,
      status: true,
      notes: true,
      createdAt: true,
    },
  });

  const headers = [
    "nome",
    "telefone",
    "email",
    "curso_interesse",
    "origem",
    "status",
    "notas",
    "criado_em",
  ];

  const csvEscape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };

  const rows = contacts.map((c) =>
    [
      c.name,
      c.phone,
      c.email ?? "",
      c.courseInterest ?? "",
      c.source ?? "",
      c.status,
      c.notes ?? "",
      c.createdAt.toISOString(),
    ]
      .map(csvEscape)
      .join(",")
  );

  // ﻿ = BOM para Excel reconhecer UTF-8 (acentos)
  const csv = "﻿" + headers.join(",") + "\n" + rows.join("\n");
  const filename = `contatos-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
