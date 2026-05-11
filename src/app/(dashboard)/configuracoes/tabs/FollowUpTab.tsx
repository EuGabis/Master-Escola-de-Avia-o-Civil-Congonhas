"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Plus, Pencil, Trash2, Power, PowerOff, Clock } from "lucide-react";
import { Modal, Button, Input, Textarea, Label } from "@/components/Modal";
import { cn } from "@/lib/cn";

interface FollowUp {
  id: string;
  name: string;
  enabled: boolean;
  inactivityHours: number;
  message: string;
  maxTimes: number;
}

export function FollowUpTab() {
  const [items, setItems] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ mode: "create" | "edit"; item?: FollowUp } | null>(null);
  const [del, setDel] = useState<FollowUp | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/followups");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(item: FollowUp) {
    await fetch(`/api/followups/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !item.enabled }),
    });
    void load();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-300 flex gap-3">
        <Clock size={18} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Como funciona</p>
          <p className="text-xs opacity-90 mt-1">
            A cada dia, as 10h (horario de Brasilia), o sistema verifica conversas em
            aberto sem resposta ha mais de N horas e envia automaticamente a mensagem
            configurada (recupera leads frios sem trabalho manual).
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Follow-ups configurados
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {items.length} regras de reengajamento
            </p>
          </div>
          <Button onClick={() => setEditing({ mode: "create" })}>
            <span className="flex items-center gap-2">
              <Plus size={14} /> Novo follow-up
            </span>
          </Button>
        </header>

        {loading ? (
          <p className="p-5 text-sm text-slate-500">Carregando...</p>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-12 h-12 rounded-full bg-master-orange/10 text-master-orange flex items-center justify-center mx-auto mb-3">
              <Bell size={20} />
            </div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Sem follow-ups ainda
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Exemplo pratico: <em>&quot;Apos 24h sem resposta, envia mensagem
              perguntando se a pessoa precisa de algo&quot;</em>. Aumenta a taxa
              de conversao sem esforco manual.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((it) => (
              <div
                key={it.id}
                className={cn(
                  "px-5 py-4 group transition",
                  !it.enabled && "opacity-60"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                      it.enabled
                        ? "bg-master-orange/10 text-master-orange"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                    )}
                  >
                    <Bell size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                        {it.name}
                      </h3>
                      <span
                        className={cn(
                          "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium",
                          it.enabled
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                        )}
                      >
                        {it.enabled ? "Ativo" : "Pausado"}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 space-y-1">
                      <div>
                        <span className="font-medium">Apos</span>{" "}
                        <strong>{it.inactivityHours}h</strong> sem resposta ·{" "}
                        <span className="font-medium">envia ate</span>{" "}
                        <strong>{it.maxTimes}x</strong> por contato
                      </div>
                      <div className="text-slate-600 dark:text-slate-300 italic line-clamp-1">
                        &quot;{it.message}&quot;
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => void toggle(it)}
                      className={cn(
                        "p-1.5 rounded-lg transition",
                        it.enabled
                          ? "text-emerald-500 hover:bg-emerald-500/10"
                          : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      )}
                      title={it.enabled ? "Pausar" : "Ativar"}
                    >
                      {it.enabled ? <Power size={14} /> : <PowerOff size={14} />}
                    </button>
                    <button
                      onClick={() => setEditing({ mode: "edit", item: it })}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-master-orange hover:bg-master-orange/10 transition opacity-0 group-hover:opacity-100"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDel(it)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <Form
          mode={editing.mode}
          item={editing.item}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}

      {del && (
        <Modal
          open
          onClose={() => setDel(null)}
          title="Apagar follow-up"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDel(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await fetch(`/api/followups/${del.id}`, { method: "DELETE" });
                  setDel(null);
                  void load();
                }}
              >
                Apagar
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Apagar <strong>{del.name}</strong>?
          </p>
        </Modal>
      )}
    </div>
  );
}

function Form({
  mode,
  item,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  item?: FollowUp;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [hours, setHours] = useState(item?.inactivityHours ?? 24);
  const [maxTimes, setMaxTimes] = useState(item?.maxTimes ?? 1);
  const [message, setMessage] = useState(item?.message ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim() || !message.trim()) return;
    setSaving(true);
    setError(null);
    const url = mode === "create" ? "/api/followups" : `/api/followups/${item!.id}`;
    const res = await fetch(url, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        inactivityHours: hours,
        maxTimes,
        message: message.trim(),
      }),
    });
    setSaving(false);
    if (res.ok) onSaved();
    else setError((await res.json()).error ?? "Erro");
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "create" ? "Novo follow-up" : "Editar follow-up"}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || !name.trim() || !message.trim()}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm p-3">
            {error}
          </div>
        )}
        <div>
          <Label>Nome</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex: Recuperar lead frio"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Apos quantas horas sem resposta?</Label>
            <Input
              type="number"
              min={1}
              max={720}
              value={hours}
              onChange={(e) => setHours(parseInt(e.target.value) || 24)}
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Sugestao: 24h (1 dia) ou 72h (3 dias)
            </p>
          </div>
          <div>
            <Label>Maximo de envios por contato</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={maxTimes}
              onChange={(e) => setMaxTimes(parseInt(e.target.value) || 1)}
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Evita spam. Sugestao: 1 ou 2.
            </p>
          </div>
        </div>
        <div>
          <Label>Mensagem a enviar</Label>
          <Textarea
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="ex: Oi! Notamos que voce demonstrou interesse no curso. Posso te ajudar com alguma duvida?"
          />
          <p className="text-[10px] text-slate-500 mt-1">
            Mensagem que sera enviada automaticamente. Seja gentil e ofereca
            ajuda especifica.
          </p>
        </div>
      </div>
    </Modal>
  );
}
