import { db } from "@/lib/db";

/**
 * Roda todas as automacoes habilitadas do workspace para a mensagem recebida.
 *
 * Tipos de gatilho:
 *   - keyword       -> aciona se UMA das palavras (CSV) aparece na mensagem
 *   - first_message -> aciona se eh a primeira mensagem da conversa
 *
 * Acoes (aplicadas em ordem; cada uma eh opcional):
 *   - addLabelName     -> aplica etiqueta com esse nome (cria se nao existe)
 *   - pipelineColumnId -> move/cria kanban card na coluna
 *   - assignUserId     -> atribui conversa a um usuario
 *
 * Idempotencia: se a label/card/assignment ja existir, ignora silenciosamente.
 */

interface RunInput {
  workspaceId: string;
  conversationId: string;
  contactName: string;
  messageContent: string;
  isFirstMessage: boolean;
}

export async function runAutomations(input: RunInput) {
  const automations = await db.automation.findMany({
    where: { workspaceId: input.workspaceId, enabled: true },
    orderBy: { createdAt: "asc" },
  });

  for (const auto of automations) {
    if (!matchesTrigger(auto, input)) continue;

    try {
      // 1) APLICAR ETIQUETA
      if (auto.addLabelName) {
        const labelName = auto.addLabelName.trim();
        let label = await db.label.findUnique({
          where: { workspaceId_name: { workspaceId: input.workspaceId, name: labelName } },
        });
        if (!label) {
          label = await db.label.create({
            data: {
              workspaceId: input.workspaceId,
              name: labelName,
              color: randomColor(),
            },
          });
        }
        await db.conversationLabel
          .create({
            data: { conversationId: input.conversationId, labelId: label.id },
          })
          .catch(() => null);
      }

      // 2) MOVER/CRIAR KANBAN CARD
      if (auto.pipelineColumnId) {
        const col = await db.kanbanColumn.findFirst({
          where: { id: auto.pipelineColumnId, workspaceId: input.workspaceId },
          select: { id: true },
        });
        if (col) {
          const existing = await db.kanbanCard.findUnique({
            where: { conversationId: input.conversationId },
          });
          if (existing) {
            if (existing.columnId !== col.id) {
              await db.kanbanCard.update({
                where: { id: existing.id },
                data: { columnId: col.id },
              });
            }
          } else {
            const last = await db.kanbanCard.findFirst({
              where: { columnId: col.id },
              orderBy: { order: "desc" },
              select: { order: true },
            });
            await db.kanbanCard.create({
              data: {
                columnId: col.id,
                conversationId: input.conversationId,
                title: input.contactName,
                order: (last?.order ?? -1) + 1,
              },
            });
          }
        }
      }

      // 3) ATRIBUIR A USUARIO
      if (auto.assignUserId) {
        const user = await db.user.findFirst({
          where: { id: auto.assignUserId, workspaceId: input.workspaceId },
          select: { id: true },
        });
        if (user) {
          await db.conversationAssignment
            .create({
              data: { conversationId: input.conversationId, userId: user.id },
            })
            .catch(() => null);
        }
      }
    } catch (err) {
      console.error(`[automation] erro em ${auto.name}:`, err);
    }
  }
}

function matchesTrigger(
  auto: { triggerType: string; keywords: string | null },
  input: RunInput
): boolean {
  if (auto.triggerType === "first_message") {
    return input.isFirstMessage;
  }
  if (auto.triggerType === "keyword") {
    if (!auto.keywords) return false;
    const words = auto.keywords
      .split(",")
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);
    if (words.length === 0) return false;
    const content = input.messageContent.toLowerCase();
    return words.some((w) => content.includes(w));
  }
  return false;
}

function randomColor() {
  const palette = [
    "#6366f1", "#3b82f6", "#10b981", "#f59e0b",
    "#ef4444", "#ec4899", "#8b5cf6", "#06b6d4",
  ];
  return palette[Math.floor(Math.random() * palette.length)]!;
}
