import { db } from "@/lib/db";
import { sendText } from "@/lib/evolution";
import { pusher, channels, events as ev } from "@/lib/pusher";

/**
 * Processa todos os FollowUps de todos os workspaces.
 *
 * Acionado por:
 *   - Vercel Cron diariamente (configurado em vercel.json)
 *   - Manualmente via POST /api/cron/followup (com header de seguranca)
 *
 * Regra:
 *   - Para cada FollowUp habilitado, busca conversas em status 'open'
 *     cuja ultima mensagem foi ha >= inactivityHours horas
 *   - Limita por maxTimes (nao manda mais que N vezes pro mesmo contato)
 *   - Registra FollowUpLog (chave conversa+followup) com sentCount++
 */
export async function processFollowUps(): Promise<{
  totalSent: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let totalSent = 0;

  const followUps = await db.followUp.findMany({
    where: { enabled: true, triggerType: "inactivity" },
  });

  for (const fu of followUps) {
    if (!fu.inactivityHours || !fu.message) continue;
    const cutoff = new Date(Date.now() - fu.inactivityHours * 60 * 60 * 1000);

    // Conversas elegiveis: ultima mensagem antes do cutoff, status open
    const conversations = await db.conversation.findMany({
      where: {
        workspaceId: fu.workspaceId,
        status: "open",
        lastMessageAt: { lte: cutoff },
      },
      include: { contact: { select: { phone: true } } },
      take: 50, // limite por execucao
    });

    for (const conv of conversations) {
      // Checa quantas vezes ja foi enviado pra essa conversa
      const log = await db.followUpLog.findUnique({
        where: {
          followUpId_conversationId: {
            followUpId: fu.id,
            conversationId: conv.id,
          },
        },
      });

      if (log && log.sentCount >= fu.maxTimes) continue;

      // Se ja enviou e ainda nao passou novo periodo desde o ultimo envio, pula
      if (log && log.lastSentAt > cutoff) continue;

      try {
        // Envia mensagem
        await sendText({
          number: conv.contact.phone,
          text: fu.message,
        });

        // Salva no log
        await db.followUpLog.upsert({
          where: {
            followUpId_conversationId: {
              followUpId: fu.id,
              conversationId: conv.id,
            },
          },
          create: {
            followUpId: fu.id,
            conversationId: conv.id,
            sentCount: 1,
          },
          update: {
            sentCount: { increment: 1 },
            lastSentAt: new Date(),
          },
        });

        // Salva como mensagem out
        await db.message.create({
          data: {
            conversationId: conv.id,
            content: fu.message,
            type: "text",
            direction: "out",
            status: "sent",
            timestamp: new Date(),
          },
        });

        await db.conversation.update({
          where: { id: conv.id },
          data: {
            lastMessage: fu.message.slice(0, 200),
            lastMessageAt: new Date(),
          },
        });

        // Notifica via Pusher
        await pusher
          .trigger(channels.workspace(fu.workspaceId), ev.messageNew, {
            conversationId: conv.id,
            direction: "out",
            content: fu.message.slice(0, 200),
            source: "followup",
          })
          .catch(() => null);

        // Transferencia opcional pro humano apos enviar
        if (fu.transferToUserId) {
          await db.conversationAssignment
            .create({
              data: { conversationId: conv.id, userId: fu.transferToUserId },
            })
            .catch(() => null);
        }

        totalSent++;
      } catch (err) {
        errors.push(
          `${fu.name} -> ${conv.contact.phone}: ${err instanceof Error ? err.message : "erro"}`
        );
      }
    }
  }

  return { totalSent, errors };
}
