"use client";

import PusherClient from "pusher-js";

/**
 * Cliente Pusher do lado browser.
 * Conecta UMA VEZ e fica escutando os canais que a UI assinar.
 */
let pusherInstance: PusherClient | null = null;

export function getPusherClient(): PusherClient {
  if (pusherInstance) return pusherInstance;

  pusherInstance = new PusherClient(
    process.env.NEXT_PUBLIC_PUSHER_KEY!,
    {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: "/api/pusher/auth",
      // Mandamos o cookie de sessao automaticamente
      auth: { headers: {} },
    }
  );

  return pusherInstance;
}

export function disconnectPusher() {
  if (pusherInstance) {
    pusherInstance.disconnect();
    pusherInstance = null;
  }
}
