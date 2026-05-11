import { db } from "@/lib/db";

/**
 * Atribui automaticamente um agente novo a uma conversa pela estrategia
 * "menos carregado": pega o usuario do workspace com menos atribuicoes abertas.
 *
 * Roda quando:
 *   - Primeira mensagem de um contato chega (webhook)
 *
 * Nao sobrescreve atribuicao existente.
 *
 * Retorna o userId atribuido ou null se nenhum agente disponivel.
 */
export async function autoAssignAgent(
  workspaceId: string,
  conversationId: string
): Promise<string | null> {
  // Ja tem atribuicao?
  const existing = await db.conversationAssignment.findFirst({
    where: { conversationId },
    select: { userId: true },
  });
  if (existing) return existing.userId;

  // Agentes ativos do workspace (excluindo owners, que sao gerentes)
  const agents = await db.user.findMany({
    where: { workspaceId, role: { in: ["agent", "admin"] } },
    select: {
      id: true,
      _count: {
        select: {
          assignments: {
            where: { conversation: { status: "open" } },
          },
        },
      },
    },
  });
  if (agents.length === 0) return null;

  // Ordena por menos atribuicoes abertas
  agents.sort((a, b) => a._count.assignments - b._count.assignments);
  const chosen = agents[0]!;

  await db.conversationAssignment.create({
    data: { conversationId, userId: chosen.id },
  });

  return chosen.id;
}
