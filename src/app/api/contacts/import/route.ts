import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth/audit";
import { getClientIp, getUserAgent } from "@/lib/auth/request";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  csv: z.string().min(1).max(2_000_000), // ~2MB
});

const VALID_STATUS = new Set(["lead", "aluno", "ex_aluno", "perdido"]);
const VALID_COURSES = new Set(["PP", "PC", "Comissario", "INVA", "outro"]);

/**
 * Parser CSV simples (sem dependencia externa).
 * Suporta quoted fields com "" escape.
 */
function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;

  // remove BOM se houver
  const text = input.replace(/^﻿/, "");

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cur.push(field);
        field = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }
  if (field || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * POST /api/contacts/import
 *
 * Cabecalho aceito (case-insensitive):
 *   nome|name, telefone|phone, email, curso|curso_interesse, origem|source, status, notas|notes
 *
 * Comportamento:
 *   - Se phone duplica contato existente, ATUALIZA os campos
 *   - Se phone novo, CRIA
 *   - Retorna { created, updated, skipped, errors[] }
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.role !== "owner" && session.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem importar" },
      { status: 403 }
    );
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "CSV inválido" }, { status: 400 });
  }

  const rows = parseCsv(body.csv);
  if (rows.length < 2) {
    return NextResponse.json(
      { error: "CSV vazio ou sem dados (cabeçalho + ao menos 1 linha)" },
      { status: 400 }
    );
  }

  const header = rows[0]!.map((h) => h.trim().toLowerCase());

  const idx = {
    name: header.findIndex((h) => h === "nome" || h === "name"),
    phone: header.findIndex((h) => h === "telefone" || h === "phone"),
    email: header.findIndex((h) => h === "email"),
    course: header.findIndex(
      (h) => h === "curso" || h === "curso_interesse" || h === "curso de interesse"
    ),
    source: header.findIndex((h) => h === "origem" || h === "source"),
    status: header.findIndex((h) => h === "status"),
    notes: header.findIndex(
      (h) => h === "notas" || h === "notes" || h === "observacoes"
    ),
  };

  if (idx.name < 0 || idx.phone < 0) {
    return NextResponse.json(
      { error: "CSV precisa ter ao menos as colunas 'nome' e 'telefone'" },
      { status: 400 }
    );
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    const name = (row[idx.name] ?? "").trim();
    const phoneRaw = (row[idx.phone] ?? "").trim();
    const phone = normalizePhone(phoneRaw);

    if (!name || !phone || phone.length < 8) {
      skipped++;
      errors.push(`Linha ${i + 1}: nome ou telefone inválido`);
      continue;
    }

    const data: Record<string, unknown> = {
      name,
      phone,
      email: idx.email >= 0 ? row[idx.email]?.trim() || null : undefined,
      notes: idx.notes >= 0 ? row[idx.notes]?.trim() || null : undefined,
    };

    if (idx.course >= 0) {
      const c = row[idx.course]?.trim();
      if (c && VALID_COURSES.has(c)) data.courseInterest = c;
    }
    if (idx.source >= 0) {
      const s = row[idx.source]?.trim();
      if (s) data.source = s;
    }
    if (idx.status >= 0) {
      const s = row[idx.status]?.trim();
      if (s && VALID_STATUS.has(s)) data.status = s;
    }

    try {
      const existing = await db.contact.findUnique({
        where: { workspaceId_phone: { workspaceId: session.wid, phone } },
        select: { id: true },
      });
      if (existing) {
        await db.contact.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await db.contact.create({
          data: {
            workspaceId: session.wid,
            name,
            phone,
            email: data.email as string | null | undefined,
            notes: data.notes as string | null | undefined,
            courseInterest: data.courseInterest as string | undefined,
            source: data.source as string | undefined,
            status: data.status as string | undefined,
          },
        });
        created++;
      }
    } catch (err) {
      skipped++;
      errors.push(
        `Linha ${i + 1}: ${err instanceof Error ? err.message : "erro"}`
      );
    }
  }

  await audit({
    workspaceId: session.wid,
    userId: session.uid,
    action: "contact.bulk_import",
    meta: { created, updated, skipped },
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
  });

  return NextResponse.json({
    ok: true,
    created,
    updated,
    skipped,
    errors: errors.slice(0, 20), // limita pra resposta nao crescer demais
  });
}
