import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  findContacts,
  findChats,
  fetchProfilePicture,
  normalizePhone,
  pickEvolutionName,
} from "@/lib/evolution";

export const dynamic = "force-dynamic";

// Quantas fotos buscar por sync via fetchProfilePictureUrl (contatos que
// nao vieram com profilePicUrl no payload). Limita pra nao estourar o
// tempo da serverless function.
const AVATAR_FETCH_CAP = 60;
const AVATAR_FETCH_CONCURRENCY = 8;

/** Roda `fn` sobre `items` com no maximo `concurrency` em paralelo. */
async function pool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * POST /api/contacts/sync-names
 *
 * Sincroniza contatos com o WhatsApp via Evolution:
 *  1. Atualiza NOME dos contatos existentes (pushName/verifiedName/notify/name).
 *  2. Atualiza a FOTO (avatar) usando profilePicUrl do payload e, pros que
 *     nao vierem com foto, busca via fetchProfilePictureUrl (com limite).
 *  3. CRIA contatos novos que a Evolution conhece mas ainda nao estao no CRM
 *     (apenas os que tem nome e telefone validos; ignora grupos).
 *
 * Tenta varias fontes (findContacts + findChats) porque a Evolution v2
 * retorna os campos em lugares diferentes dependendo da versao.
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

  // Indexa nome + foto por telefone. Chats primeiro pro nome (pushName mais
  // atualizado na v2); a foto so vem em findContacts (profilePicUrl).
  const nameByPhone = new Map<string, string>();
  const avatarByPhone = new Map<string, string>();
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
    if (!phone) continue;
    const name = pickEvolutionName(c);
    // So substitui o nome do chat se o atual estiver vazio
    if (name && !nameByPhone.has(phone)) nameByPhone.set(phone, name);
    if (c.profilePicUrl) avatarByPhone.set(phone, c.profilePicUrl);
  }

  const contacts = await db.contact.findMany({
    where: { workspaceId: session.wid },
    select: { id: true, name: true, phone: true, avatar: true },
  });
  const existingPhones = new Set(contacts.map((c) => c.phone));

  // 1 + 2) Atualiza nome e/ou foto dos contatos existentes
  let updatedNames = 0;
  let updatedAvatars = 0;
  let skippedNoMatch = 0;
  const noMatchSamples: string[] = [];
  for (const c of contacts) {
    const newName = nameByPhone.get(c.phone);
    const newAvatar = avatarByPhone.get(c.phone);
    const data: { name?: string; avatar?: string } = {};
    if (newName && newName !== c.name) data.name = newName;
    if (newAvatar && newAvatar !== c.avatar) data.avatar = newAvatar;
    if (Object.keys(data).length === 0) {
      if (!newName) {
        skippedNoMatch++;
        if (noMatchSamples.length < 5) noMatchSamples.push(c.phone);
      }
      continue;
    }
    await db.contact.update({ where: { id: c.id }, data });
    if (data.name) updatedNames++;
    if (data.avatar) updatedAvatars++;
  }

  // 3) Cria contatos novos que a Evolution conhece e o CRM ainda nao tem.
  // Requisito: telefone valido (>=10 digitos), nome real, nao-grupo.
  const toCreate = new Map<string, { name: string; avatar: string | null }>();
  for (const c of evContacts) {
    const jid = c.remoteJid ?? c.id ?? "";
    if (!jid || jid.endsWith("@g.us")) continue;
    const phone = normalizePhone(jid);
    const name = pickEvolutionName(c);
    if (!phone || phone.length < 10 || !name) continue;
    if (existingPhones.has(phone) || toCreate.has(phone)) continue;
    toCreate.set(phone, { name, avatar: c.profilePicUrl ?? null });
  }
  let created = 0;
  if (toCreate.size > 0) {
    const res = await db.contact.createMany({
      data: Array.from(toCreate.entries()).map(([phone, v]) => ({
        workspaceId: session.wid,
        name: v.name,
        phone,
        avatar: v.avatar,
        status: "lead",
        source: "whatsapp",
      })),
      skipDuplicates: true,
    });
    created = res.count;
  }

  // 2b) Enriquecimento: busca foto pros contatos que ainda estao sem avatar
  // (payload nao trouxe profilePicUrl). Limitado pra nao estourar tempo.
  const missing = await db.contact.findMany({
    where: { workspaceId: session.wid, avatar: null },
    select: { id: true, phone: true },
    take: AVATAR_FETCH_CAP,
  });
  let fetchedAvatars = 0;
  if (missing.length > 0) {
    await pool(missing, AVATAR_FETCH_CONCURRENCY, async (c) => {
      const url = await fetchProfilePicture(c.phone);
      if (url) {
        await db.contact.update({ where: { id: c.id }, data: { avatar: url } });
        fetchedAvatars++;
      }
    });
  }

  return NextResponse.json({
    ok: true,
    summary: {
      totalContatos: contacts.length,
      evolutionContacts: evContacts.length,
      evolutionChats: evChats.length,
      atualizados: updatedNames,
      fotosAtualizadas: updatedAvatars + fetchedAvatars,
      criados: created,
      semCorrespondencia: skippedNoMatch,
    },
    samples: {
      contacts: evContacts.slice(0, 5).map((c) => ({
        jid: c.remoteJid ?? c.id ?? null,
        pushName: c.pushName ?? null,
        verifiedName: c.verifiedName ?? null,
        notify: c.notify ?? null,
        name: c.name ?? null,
        profilePicUrl: c.profilePicUrl ?? null,
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
