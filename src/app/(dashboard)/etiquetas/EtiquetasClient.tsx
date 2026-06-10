"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Tag,
  Search,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { Modal, Button, Input, Label } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonList } from "@/components/Skeleton";
import { cn } from "@/lib/cn";

interface LabelItem {
  id: string;
  name: string;
  color: string;
  _count: { conversations: number };
}

/**
 * Paleta refinada (saturacao 65-70%, lightness 55-60%) — cores legiveis
 * sobre branco/dark, harmonizam com o laranja Master, e nao gritam.
 * Substitui a paleta antiga (#10b981, #ec4899 saturados demais).
 */
const COLORS = [
  "#64748b", // slate
  "#0ea5e9", // sky
  "#06b6d4", // cyan
  "#14b8a6", // teal
  "#10b981", // emerald
  "#84cc16", // lime
  "#eab308", // amber
  "#f97316", // orange (combina com Master)
  "#ef4444", // red
  "#ec4899", // pink
  "#a855f7", // violet
  "#6366f1", // indigo
];

export default function EtiquetasClient() {
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<
    { mode: "create" | "edit"; label?: LabelItem } | null
  >(null);
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? labels.filter((l) => l.name.toLowerCase().includes(q))
      : labels;
    // Ordena: mais usadas primeiro, depois alfabetica
    return [...base].sort((a, b) => {
      const diff = b._count.conversations - a._count.conversations;
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [labels, search]);

  const totalConversations = useMemo(
    () => labels.reduce((sum, l) => sum + l._count.conversations, 0),
    [labels]
  );

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Etiquetas
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {labels.length}{" "}
              {labels.length === 1 ? "etiqueta" : "etiquetas"}
              {totalConversations > 0 && (
                <>
                  {" · "}
                  {totalConversations} conversas marcadas
                </>
              )}
            </p>
          </div>
          <Button onClick={() => setEditing({ mode: "create" })}>
            <span className="flex items-center gap-2">
              <Plus size={15} />
              <span className="hidden sm:inline">Nova etiqueta</span>
            </span>
          </Button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-4">
        {/* BUSCA — so aparece quando ha 5+ etiquetas */}
        {labels.length >= 5 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center gap-2">
            <Search size={15} className="text-slate-400 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar etiqueta..."
              className="flex-1 bg-transparent text-sm placeholder:text-slate-400 focus:outline-none text-slate-900 dark:text-white"
            />
          </div>
        )}

        {loading ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <SkeletonList count={5} />
          </div>
        ) : labels.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
            <EmptyState
              icon={<Tag size={28} />}
              title="Nenhuma etiqueta ainda"
              description="Etiquetas ajudam a organizar conversas por curso, status ou interesse. Ex: PP, PC, Comissário, Visita, VIP."
              action={
                <Button onClick={() => setEditing({ mode: "create" })}>
                  <span className="flex items-center gap-2">
                    <Plus size={15} /> Criar primeira etiqueta
                  </span>
                </Button>
              }
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-sm text-slate-500 text-center py-6">
              Nenhuma etiqueta com esse nome.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((l) => (
              <LabelRow
                key={l.id}
                label={l}
                onEdit={() => setEditing({ mode: "edit", label: l })}
                onDelete={() => setConfirmDel(l)}
              />
            ))}
          </div>
        )}

        {/* Texto explicativo discreto */}
        {!loading && labels.length > 0 && (
          <p className="text-[11px] text-slate-400 text-center pt-2">
            Clique na contagem pra ir direto pras conversas da etiqueta.
          </p>
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
                  await fetch(`/api/labels/${confirmDel.id}`, {
                    method: "DELETE",
                  });
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
            Apagar a etiqueta{" "}
            <span className="inline-flex items-center gap-1.5 align-middle">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: confirmDel.color }}
              />
              <strong>{confirmDel.name}</strong>
            </span>
            ?{" "}
            {confirmDel._count.conversations > 0 && (
              <>
                Ela esta em{" "}
                <strong>{confirmDel._count.conversations}</strong>{" "}
                conversa(s) e sera removida delas — as conversas continuam.
              </>
            )}
          </p>
        </Modal>
      )}
    </div>
  );
}

/**
 * Linha de etiqueta na lista. Layout limpo:
 *   [dot] Nome     12 conversas →     [editar] [apagar]
 */
function LabelRow({
  label,
  onEdit,
  onDelete,
}: {
  label: LabelItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const count = label._count.conversations;
  return (
    <div className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
        style={{ backgroundColor: label.color }}
      />
      <span className="flex-1 min-w-0 text-sm font-medium text-slate-900 dark:text-white truncate">
        {label.name}
      </span>

      {/* Contagem como link pra ver conversas */}
      {count > 0 ? (
        <Link
          href={`/conversations?label=${encodeURIComponent(label.name)}`}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-master-orange transition"
        >
          <span className="tabular-nums">{count}</span>
          <span className="hidden sm:inline">
            {count === 1 ? "conversa" : "conversas"}
          </span>
          <ExternalLink size={11} className="opacity-60" />
        </Link>
      ) : (
        <span className="text-xs text-slate-400">sem uso</span>
      )}

      <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-md text-slate-400 hover:text-master-orange hover:bg-master-orange/10 transition"
          title="Editar"
          aria-label={`Editar ${label.name}`}
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition"
          title="Apagar"
          aria-label={`Apagar ${label.name}`}
        >
          <Trash2 size={13} />
        </button>
      </div>
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
      <div className="space-y-5">
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
            maxLength={40}
          />
        </div>
        <div>
          <Label>Cor</Label>
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={cn(
                  "w-7 h-7 rounded-full transition-all duration-150 active:scale-95",
                  color === c
                    ? "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ring-slate-900 dark:ring-white scale-110"
                    : "hover:scale-110"
                )}
                aria-label={`Cor ${c}`}
              />
            ))}
          </div>
        </div>
        <div>
          <Label>Preview</Label>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm font-medium text-slate-900 dark:text-white">
              {name.trim() || "Nome da etiqueta"}
            </span>
            <span className="ml-auto inline-flex items-center text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Lista
            </span>
          </div>
          <div className="mt-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center gap-2 flex-wrap">
            {/* Pillula compacta — como aparece dentro do painel da conversa */}
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: color }}
            >
              {name.trim() || "Etiqueta"}
            </span>
            <span className="ml-auto inline-flex items-center text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              No painel
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
