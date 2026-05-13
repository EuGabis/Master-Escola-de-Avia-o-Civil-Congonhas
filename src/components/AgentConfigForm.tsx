"use client";

import { useEffect, useState } from "react";
import { Bot, Save, AlertTriangle } from "lucide-react";
import { Input, Textarea, Label, Button } from "@/components/Modal";
import { cn } from "@/lib/cn";

interface Config {
  enabled: boolean;
  systemPrompt: string;
  stopCommand: string;
  model: string;
  apiKeyMasked: string | null;
  hasApiKey: boolean;
  tokenAlertThreshold: number | null;
  tokensUsedTotal: number;
  tokensUsedMonth: number;
  lastTokenUsage: number | null;
}

const MODELS = [
  // OpenAI
  { id: "gpt-4o-mini", label: "GPT-4o Mini (OpenAI, barato)", group: "OpenAI" },
  { id: "gpt-4o", label: "GPT-4o (OpenAI, equilibrado)", group: "OpenAI" },
  { id: "gpt-4-turbo", label: "GPT-4 Turbo (OpenAI)", group: "OpenAI" },
  // Anthropic
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (Anthropic, barato)", group: "Anthropic" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (Anthropic, equilibrado)", group: "Anthropic" },
  { id: "claude-opus-4-7", label: "Claude Opus 4.7 (Anthropic, top)", group: "Anthropic" },
];

export function AgentConfigForm() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [apiKey, setApiKey] = useState(""); // input - nao recebe do GET
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/agent-config");
    const data = await res.json();
    setCfg(data.config);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(
    patch: Partial<Config> & { apiKey?: string }
  ): Promise<{ ok: boolean; error?: string }> {
    setSaving(true);
    setError(null);
    let res: Response;
    try {
      res = await fetch("/api/agent-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch (e) {
      setSaving(false);
      const msg = e instanceof Error ? e.message : "Erro de rede";
      console.error("[agent-config] fetch falhou:", e);
      setError(msg);
      return { ok: false, error: msg };
    }
    setSaving(false);
    if (res.ok) {
      setSavedAt(Date.now());
      void load();
      setApiKey(""); // limpa input apos salvar
      return { ok: true };
    }
    // tenta extrair mensagem do server
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
      if (Array.isArray(data?.details) && data.details.length)
        msg += " — " + data.details.join("; ");
      else if (typeof data?.details === "string") msg += " — " + data.details;
    } catch {
      /* response sem JSON */
    }
    console.error("[agent-config] save falhou:", msg, "patch:", patch);
    setError(msg);
    return { ok: false, error: msg };
  }

  if (!cfg) return <p className="text-sm text-slate-500">Carregando...</p>;

  const monthUsage = cfg.tokensUsedMonth;
  const limit = cfg.tokenAlertThreshold;
  const pct = limit ? Math.min(100, (monthUsage / limit) * 100) : 0;
  const exceeded = limit && monthUsage >= limit;

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 text-sm p-3 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Nao foi possivel salvar</div>
            <div className="text-xs mt-0.5 opacity-90 break-words">{error}</div>
          </div>
        </div>
      )}
      {/* Toggle principal */}
      <div className="flex items-center justify-between p-4 bg-master-orange/5 dark:bg-master-orange/10 rounded-xl border border-master-orange/20">
        <div className="flex items-start gap-3">
          <Bot className="text-master-orange shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
              Agente IA ativo
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Quando ligado, responde automaticamente nas conversas com{" "}
              <strong>IA habilitada</strong>.
            </p>
          </div>
        </div>
        <label className="cursor-pointer">
          <input
            type="checkbox"
            checked={cfg.enabled}
            onChange={(e) => void save({ enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-10 h-5 bg-slate-300 dark:bg-slate-700 rounded-full peer-checked:bg-master-orange transition relative">
            <div
              className={cn(
                "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition shadow-sm",
                cfg.enabled && "translate-x-5"
              )}
            />
          </div>
        </label>
      </div>

      {/* API Key */}
      <div>
        <Label>API Key (OpenAI ou Anthropic)</Label>
        <div className="flex gap-2">
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={cfg.apiKeyMasked ?? "sk-ant-..."}
          />
          {apiKey && (
            <Button
              onClick={() => void save({ apiKey })}
              disabled={saving}
            >
              <span className="flex items-center gap-1">
                <Save size={14} /> Salvar
              </span>
            </Button>
          )}
        </div>
        <p className="text-[10px] text-slate-500 mt-1">
          {cfg.hasApiKey ? (
            <>Chave configurada: <code>{cfg.apiKeyMasked}</code></>
          ) : (
            <>Nenhuma chave configurada. Pegue em{" "}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer"
                className="text-master-orange hover:underline"
              >
                console.anthropic.com
              </a>
            </>
          )}
        </p>
      </div>

      {/* Modelo */}
      <div>
        <Label>Modelo</Label>
        <select
          value={cfg.model}
          onChange={(e) => void save({ model: e.target.value })}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-master-orange"
        >
          <optgroup label="OpenAI (chave sk-...)">
            {MODELS.filter((m) => m.group === "OpenAI").map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Anthropic Claude (chave sk-ant-...)">
            {MODELS.filter((m) => m.group === "Anthropic").map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </optgroup>
        </select>
        <p className="text-[10px] text-slate-500 mt-1">
          O sistema detecta o provedor pela sua chave automaticamente. Escolha um
          modelo compativel com sua chave (OpenAI sk-... ou Anthropic sk-ant-...).
        </p>
      </div>

      {/* System prompt */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label>System Prompt (instrucoes do agente)</Label>
          <PromptSaveButton
            value={cfg.systemPrompt}
            onSave={(v) => save({ systemPrompt: v })}
          />
        </div>
        <Textarea
          rows={10}
          value={cfg.systemPrompt}
          onChange={(e) => setCfg({ ...cfg, systemPrompt: e.target.value })}
          onBlur={() => void save({ systemPrompt: cfg.systemPrompt })}
          className="font-mono text-xs"
        />
        <p className="text-[10px] text-slate-500 mt-1">
          Personalize tom de voz, limites de informacao, etc. Salva ao clicar
          em <strong>Salvar prompt</strong> ou ao sair do campo.
        </p>
      </div>

      {/* Stop command */}
      <div>
        <Label>Comando para desligar IA na conversa</Label>
        <Input
          value={cfg.stopCommand}
          onChange={(e) => setCfg({ ...cfg, stopCommand: e.target.value })}
          onBlur={() => void save({ stopCommand: cfg.stopCommand })}
          placeholder="/humano"
        />
        <p className="text-[10px] text-slate-500 mt-1">
          Quando o usuario manda exatamente essa mensagem, a IA para de responder
          nessa conversa (vira pendente para humano atender).
        </p>
      </div>

      {/* Token alert */}
      <div>
        <Label>Limite de tokens/mes (alerta)</Label>
        <Input
          type="number"
          min={1000}
          step={1000}
          value={cfg.tokenAlertThreshold ?? ""}
          onChange={(e) =>
            setCfg({
              ...cfg,
              tokenAlertThreshold: e.target.value
                ? parseInt(e.target.value, 10)
                : null,
            })
          }
          onBlur={() =>
            void save({ tokenAlertThreshold: cfg.tokenAlertThreshold })
          }
          placeholder="ex: 100000 (deixe vazio para sem limite)"
        />
        <p className="text-[10px] text-slate-500 mt-1">
          Quando atingir o limite, a IA para de responder automaticamente.
        </p>
      </div>

      {/* Token usage */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
            Uso este mes
          </span>
          {exceeded && (
            <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
              <AlertTriangle size={12} /> Limite atingido
            </span>
          )}
        </div>
        <div className="text-2xl font-bold text-slate-900 dark:text-white">
          {monthUsage.toLocaleString("pt-BR")}{" "}
          <span className="text-sm font-normal text-slate-500">tokens</span>
        </div>
        {limit && (
          <div className="mt-2">
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all",
                  exceeded ? "bg-red-500" : "bg-master-orange"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              {pct.toFixed(1)}% de {limit.toLocaleString("pt-BR")}
            </div>
          </div>
        )}
      </div>

      <div className="text-xs text-slate-500">
        {saving
          ? "Salvando..."
          : savedAt
            ? "Salvo " + new Date(savedAt).toLocaleTimeString("pt-BR")
            : ""}
      </div>
    </div>
  );
}

function PromptSaveButton({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  return (
    <button
      type="button"
      onClick={async () => {
        setState("saving");
        const r = await onSave(value);
        if (r.ok) {
          setState("saved");
          setTimeout(() => setState("idle"), 1500);
        } else {
          setState("error");
          setTimeout(() => setState("idle"), 2500);
        }
      }}
      disabled={state === "saving"}
      className={cn(
        "text-xs font-medium px-2.5 py-1 rounded-lg transition flex items-center gap-1.5",
        state === "saved"
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : state === "error"
            ? "bg-red-500/15 text-red-600 dark:text-red-400"
            : "bg-master-orange hover:bg-master-orange-600 text-white"
      )}
    >
      {state === "saving"
        ? "Salvando..."
        : state === "saved"
          ? "✓ Salvo"
          : state === "error"
            ? "✗ Falhou"
            : "Salvar prompt"}
    </button>
  );
}
