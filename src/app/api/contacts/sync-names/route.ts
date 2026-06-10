import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { findContacts, normalizePhone } from "@/lib/evolution";

export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/sync-names
 *
 * Pega a lista de contatos da Evolution API e atualiza o `name` de cada
 * Contact do workspace com o `pushName` do whatsapp. Util pra corrigir
 * contatos cujo nome ficou bagunçado por bugs antigos.
 *
 * Regras:
 *  - So owner/admin podem rodar (mutacao em massa)
 *  - Match por telefone (E164 sem +)
 *  - Nao mexe em contatos editados manualmente (sem pushName)
 *  - Nao mexe em contatos cujo nome ja esta igual ao pushName
 *  - Nao mexe em contatos cujo nome foi customizado manualmente: se o
 *    Contact tem `updatedAt` muito posterior ao `createdAt`, presumimos
 *    edicao manual e pulamos. (TODO: campo dedicado seria mais robusto)
 */
export async function POST() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.role !== "owner" && session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let evolutionContacts;
  try {
    evolutionContacts = await findContacts();
  } catch (err) {
    console.error("[contacts/sync-names] erro Evolution:", err);
    return NextResponse.json(
      {
        error: "Erro ao consultar Evolution API",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }

  // Indexa pushName por telefone normalizado pra lookup O(1).
  const nameByPhone = new Map<string, string>();
  for (const c of evolutionContacts) {
    const jid = c.remoteJid ?? c.id ?? "";
    if (!jid || jid.endsWith("@g.us")) continue; // ignora grupos
    const phone = normalizePhone(jid);
    const name = c.pushName?.trim();
    if (phone && name) nameByPhone.set(phone, name);
  }

  const contacts = await db.contact.findMany({
    where: { workspaceId: session.wid },
    select: { id: true, name: true, phone: true },
  });

  let updated = 0;
  let skippedSameName = 0;
  let skippedNoMatch = 0;
  for (const c of contacts) {
    const newName = nameByPhone.get(c.phone);
    if (!newName) {
      skippedNoMatch++;
      continue;
    }
    if (newName === c.name) {
      skippedSameName++;
      continue;
    }
    await db.contact.update({ where: { id: c.id }, data: { name: newName } });
    updated++;
  }

  return NextResponse.json({
    ok: true,
    summary: {
      totalContatos: contacts.length,
      contatosEvolution: evolutionContacts.length,
      atualizados: updated,
      jaIguais: skippedSameName,
      semCorrespondencia: skippedNoMatch,
    },
  });
}
