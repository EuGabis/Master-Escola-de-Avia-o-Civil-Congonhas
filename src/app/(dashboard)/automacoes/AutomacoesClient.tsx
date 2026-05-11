"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Zap, Power, PowerOff } from "lucide-react";
import { Modal, Button, Input, Label } from "@/components/Modal";
import { cn } from "@/lib/cn";

interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: "keyword" | "first_message";
  keywords: string | null;
  assignUserId: string | null;
  pipelineColumnId: string | null;
  addLabelName: string | null;
}

interface KanbanColumn { id: string; name: string; color: string }

export default function AutomacoesClient() {
  const [items, setItems] = useState<Automation[]>([]);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ mode: "create" | "edit"; auto?: Automation } | null>(null);
  const [confirmDel, setConfirmDel] = useState<Automation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, k] = await Promise.all([
      fetch("/api/automations").then((r) => r.json()),
      fetch("/api/kanban").then((r) => r.json()),
    ]);
    setItems(a.automations ?? []);
    setColumns((k.columns ?? []).map((c: KanbanColumn) => ({ id: c.id, name: c.name, color: c.color })));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function toggle(auto: Automation) {
    await fetch(`/api/automations/${auto.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !auto.enabled }),
    });
    void load();
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 lg:px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Automacoes</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {items.length} regras · classificam conversas automaticamente quando uma mensagem chega
          </p>
        </div>
        <Button onClick={() => setEditing({ mode: "create" })}>
          <span className="flex items-center gap-2"><Plus size={16} /> Nova automacao</span>
        </Button>
      </header>

      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        {loading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : items.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-master-orange/10 text-master-orange flex items-center justify-center mx-auto mb-3">
              <Zap size={24} />
            </div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Sem automacoes ainda</h2>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Crie regras para etiquetar, mover no Kanban ou atribuir conversas automaticamente.{" "}
              <strong>Ex:</strong> palavra &quot;preço&quot; aplica etiqueta <em>Financeiro</em> e move para coluna <em>Em contato</em>.
            </p>
            <Button className="mt-4" onClick={() => setEditing({ mode: "create" })}>
              <span className="flex items-center gap-2"><Plus size={16} /> Criar primeira automacao</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((a) => {
              const col = columns.find((c) => c.id === a.pipelineColumnId);
              return (
                <div key={a.id} className={cn(
                  "bg-white dark:bg-slate-900 rounded-xl border p-4 transition group",
                  a.enabled
                    ? "border-slate-200 dark:border-slate-800"
                    : "border-slate-200 dark:border-slate-800 opacity-60"
                )}>
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                      a.enabled
                        ? "bg-master-orange/10 text-master-orange"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                    )}>
                      <Zap size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900 dark:text-white truncate">{a.name}</h3>
                        <span className={cn(
                          "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium",
                          a.enabled ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                        )}>
                          {a.enabled ? "Ativa" : "Pausada"}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                        <div>
                          <span className="font-medium">QUANDO:</span>{" "}
                          {a.triggerType === "first_message"
                            ? "primeira mensagem do contato"
                            : <>mensagem contem <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{a.keywords}</code></>}
                        </div>
                        <div>
                          <span className="font-medium">ENTAO:</span>{" "}
                          {[
                            a.addLabelName && `aplica etiqueta "${a.addLabelName}"`,
                            col && `move para "${col.name}"`,
                            a.assignUserId && "atribui ao agente",
                          ].filter(Boolean).join(" + ") || <em>nenhuma acao</em>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => void toggle(a)} className={cn(
                        "p-1.5 rounded-lg transition",
                        a.enabled
                          ? "text-emerald-500 hover:bg-emerald-500/10"
                          : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      )} title={a.enabled ? "Pausar" : "Ativar"}>
                        {a.enabled ? <Power size={14} /> : <PowerOff size={14} />}
                      </button>
                      <button onClick={() => setEditing({ mode: "edit", auto: a })}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-master-orange hover:bg-master-orange/10 transition"
                        title="Editar"><Pencil size={14} /></button>
                      <button onClick={() => setConfirmDel(a)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition"
                        title="Apagar"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editing && (
        <AutomationForm
          mode={editing.mode}
          auto={editing.auto}
          columns={columns}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}

      {confirmDel && (
        <Modal open onClose={() => setConfirmDel(null)} title="Apagar automacao" size="sm"
          footer={<>
            <Button variant="ghost" onClick={() => setConfirmDel(null)}>Cancelar</Button>
            <Button variant="danger" onClick={async () => {
              await fetch(`/api/automations/${confirmDel.id}`, { method: "DELETE" });
              setConfirmDel(null);
              void load();
            }}>Apagar</Button>
          </>}
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Apagar a automacao <strong>{confirmDel.name}</strong>? Esta acao nao pode ser desfeita.
          </p>
        </Modal>
      )}
    </div>
  );
}

function AutomationForm({
  mode, auto, columns, onClose, onSaved,
}: {
  mode: "create" | "edit";
  auto?: Automation;
  columns: KanbanColumn[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(auto?.name ?? "");
  const [triggerType, setTriggerType] = useState<"keyword" | "first_message">(auto?.triggerType ?? "keyword");
  const [keywords, setKeywords] = useState(auto?.keywords ?? "");
  const [addLabelName, setAddLabelName] = useState(auto?.addLabelName ?? "");
  const [pipelineColumnId, setPipelineColumnId] = useState(auto?.pipelineColumnId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const body = {
      name: name.trim(),
      triggerType,
      keywords: triggerType === "keyword" ? keywords.trim() : null,
      addLabelName: addLabelName.trim() || null,
      pipelineColumnId: pipelineColumnId || null,
    };
    const url = mode === "create" ? "/api/automations" : `/api/automations/${auto!.id}`;
    const res = await fetch(url, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) onSaved();
    else setError((await res.json()).error ?? "Erro");
  }

  return (
    <Modal open onClose={onClose}
      title={mode === "create" ? "Nova automacao" : "Editar automacao"}
      description="Quando uma mensagem chegar, executa as acoes configuradas."
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} disabled={saving || !name.trim()}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </>}
    >
      <div className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm p-3">{error}</div>}

        <div>
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="ex: Classificar leads de Piloto Privado" autoFocus />
        </div>

        <div>
          <Label>Gatilho (quando)</Label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setTriggerType("keyword")}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition",
                triggerType === "keyword"
                  ? "border-master-orange bg-master-orange/5"
                  : "border-slate-200 dark:border-slate-700 hover:border-master-orange/50"
              )}>
              <div className="font-semibold text-slate-900 dark:text-white">Palavra-chave</div>
              <div className="text-xs text-slate-500 mt-0.5">Mensagem contem alguma das palavras</div>
            </button>
            <button type="button" onClick={() => setTriggerType("first_message")}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition",
                triggerType === "first_message"
                  ? "border-master-orange bg-master-orange/5"
                  : "border-slate-200 dark:border-slate-700 hover:border-master-orange/50"
              )}>
              <div className="font-semibold text-slate-900 dark:text-white">Primeira mensagem</div>
              <div className="text-xs text-slate-500 mt-0.5">Quando um lead novo chega</div>
            </button>
          </div>
        </div>

        {triggerType === "keyword" && (
          <div>
            <Label>Palavras-chave (separe por vírgula)</Label>
            <Input value={keywords} onChange={(e) => setKeywords(e.target.value)}
              placeholder="ex: preço, valor, quanto custa, mensalidade" />
            <p className="text-[10px] text-slate-500 mt-1">
              Match case-insensitive. Basta UMA das palavras aparecer na mensagem.
            </p>
          </div>
        )}

        <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
          <Label>Acoes (entao)</Label>
        </div>

        <div>
          <Label>Aplicar etiqueta (opcional)</Label>
          <Input value={addLabelName} onChange={(e) => setAddLabelName(e.target.value)}
            placeholder="ex: Financeiro, PP, Urgente..." />
          <p className="text-[10px] text-slate-500 mt-1">
            Cria a etiqueta automaticamente se nao existir.
          </p>
        </div>

        <div>
          <Label>Mover/criar no Kanban (opcional)</Label>
          <select value={pipelineColumnId} onChange={(e) => setPipelineColumnId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-master-orange">
            <option value="">— nenhuma —</option>
            {columns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}
