import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

/**
 * Cliente do Claude (Anthropic).
 *
 * USO:
 *   const reply = await generateAIReply({
 *     workspaceId,
 *     conversationId,
 *     systemPromptOverride: "..."  (opcional)
 *   });
 *
 * Retorna texto da resposta + tokens usados.
 * Atualiza AgentConfig.tokensUsedMonth automaticamente.
 *
 * Modelo padrao: Claude Haiku 4.5 (rapido e barato; configuravel por workspace).
 */

interface GenerateInput {
  workspaceId: string;
  conversationId: string;
}

interface GenerateOutput {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

const DEFAULT_SYSTEM = `Voce e um atendente virtual amigavel da Master Escola de Aviacao Civil de Congonhas (Sao Paulo, Brasil).

Sua funcao e responder duvidas iniciais sobre os cursos da escola:
- Piloto Privado (PP)
- Piloto Comercial (PC)
- Comissario de Voo
- Instrutor de Voo (INVA)

Diretrizes:
- Seja simpatico, curto e objetivo (no maximo 4 linhas por resposta)
- Use linguagem informal brasileira ("voce" nao "tu")
- Se a pessoa perguntar valor, datas de turma ou inscricao, oriente que um consultor humano entrara em contato em breve
- Se a pessoa pedir para falar com humano ou disser que ja esta atendido, diga "Vou transferir para um consultor agora"
- Nao invente precos, datas ou promocoes
- Nao prometa nada que dependa de aprovacao
- Use no maximo 1 emoji por resposta`;

export async function generateAIReply(
  input: GenerateInput
): Promise<GenerateOutput | null> {
  const cfg = await db.agentConfig.findUnique({
    where: { workspaceId: input.workspaceId },
  });
  if (!cfg || !cfg.enabled || !cfg.apiKey) return null;

  // Verifica limite mensal (se configurado)
  if (cfg.tokenAlertThreshold && cfg.tokensUsedMonth >= cfg.tokenAlertThreshold) {
    console.warn(
      `[ai] limite mensal atingido para workspace ${input.workspaceId}`
    );
    return null;
  }

  // Pega historico recente (max 20 mensagens)
  const messages = await db.message.findMany({
    where: { conversationId: input.conversationId },
    orderBy: { timestamp: "asc" },
    take: 20,
    select: { direction: true, content: true },
  });

  if (messages.length === 0) return null;

  // Converte pra formato Anthropic (user / assistant)
  const history = messages.map((m) => ({
    role: m.direction === "in" ? ("user" as const) : ("assistant" as const),
    content: m.content,
  }));

  // Garante que comeca com user (caso a primeira seja assistant)
  const trimmed = history[0]?.role === "assistant" ? history.slice(1) : history;
  if (trimmed.length === 0) return null;

  // Garante que termina com user (a IA so responde apos input do usuario)
  if (trimmed[trimmed.length - 1]!.role !== "user") return null;

  const client = new Anthropic({ apiKey: cfg.apiKey });

  try {
    const response = await client.messages.create({
      model: cfg.model || "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: cfg.systemPrompt || DEFAULT_SYSTEM,
      messages: trimmed,
    });

    const text =
      response.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("\n")
        .trim() || "";

    const tokensIn = response.usage.input_tokens;
    const tokensOut = response.usage.output_tokens;
    const total = tokensIn + tokensOut;

    // Atualiza contadores
    await db.agentConfig.update({
      where: { workspaceId: input.workspaceId },
      data: {
        tokensUsedTotal: { increment: total },
        tokensUsedMonth: { increment: total },
        lastTokenUsage: total,
        lastTokenUsageAt: new Date(),
      },
    });

    return { text, tokensIn, tokensOut };
  } catch (err) {
    console.error("[ai] erro Anthropic:", err);
    return null;
  }
}

/**
 * Detecta comando de stop ("/humano" por padrao) nas mensagens do contato.
 * Se detectado, desabilita aiEnabled na conversa.
 */
export async function checkStopCommand(
  workspaceId: string,
  conversationId: string,
  messageContent: string
): Promise<boolean> {
  const cfg = await db.agentConfig.findUnique({
    where: { workspaceId },
    select: { stopCommand: true },
  });
  const stop = (cfg?.stopCommand || "/humano").toLowerCase().trim();
  if (messageContent.toLowerCase().trim() === stop) {
    await db.conversation.update({
      where: { id: conversationId },
      data: { aiEnabled: false, status: "pending" },
    });
    return true;
  }
  return false;
}

export const DEFAULT_SYSTEM_PROMPT = DEFAULT_SYSTEM;
