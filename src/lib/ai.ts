import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { db } from "@/lib/db";
import { toWhatsAppFormat } from "@/lib/whatsapp-format";

/**
 * Camada de IA - suporta Anthropic Claude OU OpenAI GPT.
 * Detecta provedor pelo prefixo da apiKey:
 *   - sk-ant-...           -> Anthropic
 *   - sk-... | sk-proj-... -> OpenAI
 *
 * Mesma interface, mesma config, contabiliza tokens igual.
 */

/**
 * NOTA: ja existiu um cache em memoria do AgentConfig aqui.
 * Removido porque cache local nao invalida entre lambdas — quando o
 * usuario desligava a IA pelo painel, outras lambdas continuavam
 * respondendo por ate 10s. Correctness > performance neste path.
 *
 * Cada chamada faz query fresh (~300ms) mas garante que mudancas no
 * toggle "Agente IA ativo" valem imediatamente.
 */
export function getAgentConfigFresh(workspaceId: string) {
  return db.agentConfig.findUnique({ where: { workspaceId } });
}

// Compat: noop pra nao quebrar quem ja importava invalidateAgentConfig.
export function invalidateAgentConfig(_workspaceId: string) {
  // cache removido — nada a invalidar
}

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

function detectProvider(apiKey: string): "anthropic" | "openai" | null {
  if (apiKey.startsWith("sk-ant-")) return "anthropic";
  if (apiKey.startsWith("sk-")) return "openai";
  return null;
}

export async function generateAIReply(
  input: GenerateInput
): Promise<GenerateOutput | null> {
  const cfg = await getAgentConfigFresh(input.workspaceId);
  if (!cfg || !cfg.enabled || !cfg.apiKey) return null;

  if (cfg.tokenAlertThreshold && cfg.tokensUsedMonth >= cfg.tokenAlertThreshold) {
    console.warn(`[ai] limite mensal atingido (workspace ${input.workspaceId})`);
    return null;
  }

  const provider = detectProvider(cfg.apiKey);
  if (!provider) {
    console.error("[ai] api key invalida (prefixo desconhecido)");
    return null;
  }

  const messages = await db.message.findMany({
    where: { conversationId: input.conversationId },
    orderBy: { timestamp: "asc" },
    take: 20,
    select: { direction: true, content: true },
  });

  if (messages.length === 0) return null;

  const history = messages.map((m) => ({
    role: m.direction === "in" ? ("user" as const) : ("assistant" as const),
    content: m.content,
  }));
  const trimmed = history[0]?.role === "assistant" ? history.slice(1) : history;
  if (trimmed.length === 0 || trimmed[trimmed.length - 1]!.role !== "user") return null;

  const systemPrompt = cfg.systemPrompt || DEFAULT_SYSTEM;
  const model = cfg.model || (provider === "anthropic" ? "claude-haiku-4-5-20251001" : "gpt-4o-mini");

  let result: GenerateOutput | null = null;

  try {
    if (provider === "anthropic") {
      const client = new Anthropic({ apiKey: cfg.apiKey });
      const response = await client.messages.create({
        model,
        max_tokens: 500,
        system: systemPrompt,
        messages: trimmed,
      });
      const text =
        response.content
          .filter((b) => b.type === "text")
          .map((b) => (b.type === "text" ? b.text : ""))
          .join("\n")
          .trim() || "";
      result = {
        text,
        tokensIn: response.usage.input_tokens,
        tokensOut: response.usage.output_tokens,
      };
    } else {
      const client = new OpenAI({ apiKey: cfg.apiKey });
      const response = await client.chat.completions.create({
        model,
        max_tokens: 500,
        messages: [
          { role: "system", content: systemPrompt },
          ...trimmed,
        ],
      });
      const text = response.choices[0]?.message?.content?.trim() || "";
      result = {
        text,
        tokensIn: response.usage?.prompt_tokens ?? 0,
        tokensOut: response.usage?.completion_tokens ?? 0,
      };
    }

    if (!result || !result.text) return null;

    // Markdown do modelo (**x**, ## titulo...) -> sintaxe do WhatsApp (*x*)
    // pra negrito renderizar de verdade sem mostrar os asteriscos.
    result.text = toWhatsAppFormat(result.text);

    const total = result.tokensIn + result.tokensOut;
    await db.agentConfig.update({
      where: { workspaceId: input.workspaceId },
      data: {
        tokensUsedTotal: { increment: total },
        tokensUsedMonth: { increment: total },
        lastTokenUsage: total,
        lastTokenUsageAt: new Date(),
      },
    });
    return result;
  } catch (err) {
    console.error(`[ai] erro ${provider}:`, err);
    return null;
  }
}

export async function checkStopCommand(
  workspaceId: string,
  conversationId: string,
  messageContent: string
): Promise<boolean> {
  const cfg = await getAgentConfigFresh(workspaceId);
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
