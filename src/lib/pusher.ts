import Pusher from "pusher";
import { env } from "./env";

/**
 * Cliente Pusher do lado servidor.
 * Usado para PUBLICAR eventos em canais (ex: nova mensagem chegou).
 *
 * Canais usados:
 *   private-workspace-{wid}        -> eventos broad do workspace (nova conversa, etc)
 *   private-conversation-{id}      -> mensagens de uma conversa especifica
 *   private-user-{uid}             -> notificacoes pessoais (atribuicao, etc)
 *
 * O prefixo "private-" exige autenticacao via /api/pusher/auth.
 */
const globalForPusher = globalThis as unknown as {
  pusher: Pusher | undefined;
};

export const pusher =
  globalForPusher.pusher ??
  new Pusher({
    appId: env.PUSHER_APP_ID,
    key: env.NEXT_PUBLIC_PUSHER_KEY,
    secret: env.PUSHER_SECRET,
    cluster: env.NEXT_PUBLIC_PUSHER_CLUSTER,
    useTLS: true,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPusher.pusher = pusher;
}

/**
 * Helpers para nomenclatura consistente de canais.
 */
export const channels = {
  workspace: (wid: string) => `private-workspace-${wid}`,
  conversation: (id: string) => `private-conversation-${id}`,
  user: (uid: string) => `private-user-${uid}`,
};

/**
 * Helpers para nomenclatura consistente de eventos.
 */
export const events = {
  messageNew: "message:new",
  messageStatus: "message:status",
  conversationUpdate: "conversation:update",
  conversationAssigned: "conversation:assigned",
} as const;
