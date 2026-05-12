"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { Modal, Button, Input, Label } from "@/components/Modal";
import { cn } from "@/lib/cn";

interface LabelItem {
  id: string;
  name: string;
  color: string;
  _count: { conversations: number };
}

const COLORS = [
  "#6366f1", "#3b82f6", "#06b6d4", "#10b981", "#84cc16",
  "#f59e0b", "#f97316", "#ef4444", "#ec4899", "#8b5cf6",
];

export default function EtiquetasClient() {
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ mode: "create" | "edit"; label?: LabelItem } | null>(null);
  const [confirmDel, setConfirmDel] = useState<LabelItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/labels");
    const data = await res.json();
    setLabels(data.labels ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Etiquetas
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {labels.length} etiquetas · organize conversas por curso, status ou interesse
            </p>
          </div>
          <Button onClick={() => setEditing({ mode: "create" })}>
            <span className="flex items-center gap-2">
              <Plus size={16} /> Nova etiqueta
            </span>
          </Button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
        {loading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : labels.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-master-orange/10 text-master-orange flex items-center justify-center mx-auto mb-3">
              <Tag size={24} />
            </div>
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Nenhuma etiqueta ainda
            </h2>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Etiquetas ajudam a organizar conversas. Ex: <em>PP, PC, Comissario, Visita, Urgente, VIP.</em>
            </p>
            <Button className="mt-4" onClick={() => setEditing({ mode: "create" })}>
              <span className="flex items-center gap-2">
                <Plus size={16} /> Criar primeira etiqueta
              </span>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {labels.map((l) => (
              <div
                key={l.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between group hover:border-master-orange/40 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="text-sm font-semibold text-white px-3 py-1 rounded-full shrink-0"
                    style={{ backgroundColor: l.color }}
                  >
                    {l.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {l._count.conversations}{" "}
                    {l._count.conversations === 1 ? "conversa" : "conversas"}
                  </span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => setEditing({ mode: "edit", label: l })}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-master-orange hover:bg-master-orange/10 transition"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setConfirmDel(l)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition"
                    title="Apagar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <LabelForm
          mode={editing.mode}
          label={editing.label}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
      {confirmDel && (
        <Modal
          open
          onClose={() => setConfirmDel(null)}
          title="Apagar etiqueta"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmDel(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await fetch(`/api/labels/${confirmDel.id}`, { method: "DELETE" });
                  setConfirmDel(null);
                  void load();
                }}
              >
                Apagar
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Apagar <strong>{confirmDel.name}</strong>?{" "}
            {confirmDel._count.conversations > 0 && (
              <>Esta tag esta em <strong>{confirmDel._count.conversations}</strong>{" "}
              conversa(s) — sera removida delas.</>
            )}
          </p>
        </Modal>
      )}
    </div>
  );
}

function LabelForm({
  mode,
  label,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  label?: LabelItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(label?.name ?? "");
  const [color, setColor] = useState(label?.color ?? COLORS[0]!);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const url = mode === "create" ? "/api/labels" : `/api/labels/${label!.id}`;
    const res = await fetch(url, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), color }),
    });
    setSaving(false);
    if (res.ok) onSaved();
    else {
      const data = await res.json();
      setError(data.error ?? "Erro");
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "create" ? "Nova etiqueta" : "Editar etiqueta"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || !name.trim()}>
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
            placeholder="ex: VIP, Curso PP, Urgente..."
            autoFocus
          />
        </div>
        <div>
          <Label>Cor</Label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={cn(
                  "w-8 h-8 rounded-full transition border-2",
                  color === c
                    ? "border-slate-900 dark:border-white scale-110"
                    : "border-transparent"
                )}
              />
            ))}
          </div>
        </div>
        <div>
          <Label>Preview</Label>
          <span
            className="inline-block text-sm font-semibold text-white px-3 py-1 rounded-full"
            style={{ backgroundColor: color }}
          >
            {name || "Etiqueta"}
          </span>
        </div>
      </div>
    </Modal>
  );
}
