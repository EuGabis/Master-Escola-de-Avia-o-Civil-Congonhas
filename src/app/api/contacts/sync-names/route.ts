import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  findContacts,
  findChats,
  normalizePhone,
  pickEvolutionName,
} from "@/lib/evolution";

export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/sync-names
 *
 * Atualiza o nome dos contatos do workspace com base no que a Evolution
 * conhece do whatsapp. Tenta varias fontes (findContacts + findChats) e
 * varias chaves (pushName, verifiedName, notify, name) porque a Evolution
 * v2 retorna o pushName em lugares diferentes dependendo da versao.
 *
 * Retorna `samples` com 5 exemplos de cada fonte pra diagnostico — se a
 * sync nao tiver atualizado nada, da pra ver no toast quais campos
 * vieram da Evolution.
 */
export async function POST() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "owner" && session.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Puxa as duas fontes em paralelo, tolerando falha de uma delas
  const [contactsRes, chatsRes] = await Promise.allSettled([
    findContacts(),
    findChats(),
  ]);
  const evContacts =
    contactsRes.status === "fulfilled" ? contactsRes.value : [];
  const evChats = chatsRes.status === "fulfilled" ? chatsRes.value : [];
  const errors: string[] = [];
  if (contactsRes.status === "rejected")
    errors.push(`findContacts: ${String(contactsRes.reason)}`);
  if (chatsRes.status === "rejected")
    errors.push(`findChats: ${String(chatsRes.reason)}`);

  // Indexa nomes por telefone — chats primeiro, depois contacts (chats
  // costuma trazer o pushName mais atualizado na v2).
  const nameByPhone = new Map<string, string>();
  for (const c of evChats) {
    const jid = c.remoteJid ?? c.id ?? "";
    if (!jid || jid.endsWith("@g.us")) continue;
    const phone = normalizePhone(jid);
    const name = pickEvolutionName(c);
    if (phone && name) nameByPhone.set(phone, name);
  }
  for (const c of evContacts) {
    const jid = c.remoteJid ?? c.id ?? "";
    if (!jid || jid.endsWith("@g.us")) continue;
    const phone = normalizePhone(jid);
    const name = pickEvolutionName(c);
    // So substitui o do chat se o atual estiver vazio
    if (phone && name && !nameByPhone.has(phone)) nameByPhone.set(phone, name);
  }

  const contacts = await db.contact.findMany({
    where: { workspaceId: session.wid },
    select: { id: true, name: true, phone: true },
  });

  let updated = 0;
  let skippedSameName = 0;
  let skippedNoMatch = 0;
  const noMatchSamples: string[] = [];
  for (const c of contacts) {
    const newName = nameByPhone.get(c.phone);
    if (!newName) {
      skippedNoMatch++;
      if (noMatchSamples.length < 5) noMatchSamples.push(c.phone);
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
      evolutionContacts: evContacts.length,
      evolutionChats: evChats.length,
      atualizados: updated,
      jaIguais: skippedSameName,
      semCorrespondencia: skippedNoMatch,
    },
    samples: {
      contacts: evContacts.slice(0, 5).map((c) => ({
        jid: c.remoteJid ?? c.id ?? null,
        pushName: c.pushName ?? null,
        verifiedName: c.verifiedName ?? null,
        notify: c.notify ?? null,
        name: c.name ?? null,
      })),
      chats: evChats.slice(0, 5).map((c) => ({
        jid: c.remoteJid ?? c.id ?? null,
        pushName: c.pushName ?? null,
        notify: c.notify ?? null,
        name: c.name ?? null,
      })),
      semCorrespondenciaTelefones: noMatchSamples,
    },
    errors: errors.length ? errors : undefined,
  });
}
