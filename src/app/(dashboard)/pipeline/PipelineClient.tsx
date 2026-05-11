"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  ExternalLink,
  MoreVertical,
} from "lucide-react";
import { Modal, Button, Input, Textarea, Label } from "@/components/Modal";
import { cn } from "@/lib/cn";

interface Card {
  id: string;
  title: string;
  notes: string | null;
  order: number;
  columnId?: string;
  conversation: {
    id: string;
    lastMessage: string | null;
    contact: { name: string; phone: string };
  } | null;
}

interface Column {
  id: string;
  name: string;
  color: string;
  order: number;
  wipLimit: number | null;
  cards: Card[];
}

const COLORS = [
  "#94a3b8", "#3b82f6", "#f59e0b", "#10b981", "#ef4444",
  "#8b5cf6", "#ec4899", "#f97316", "#06b6d4", "#84cc16",
];

export default function PipelineClient() {
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<{ cardId: string; fromColId: string } | null>(null);
  const [hoverCol, setHoverCol] = useState<string | null>(null);

  // Modal states
  const [columnModal, setColumnModal] = useState<{
    mode: "create" | "edit";
    column?: Column;
  } | null>(null);
  const [deleteColModal, setDeleteColModal] = useState<Column | null>(null);
  const [cardModal, setCardModal] = useState<{
    mode: "create" | "edit";
    columnId: string;
    card?: Card;
  } | null>(null);
  const [deleteCardModal, setDeleteCardModal] = useState<Card | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/kanban");
      if (!res.ok) return;
      const data = await res.json();
      setColumns(data.columns);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function moveCard(cardId: string, toColId: string) {
    setColumns((cols) => {
      const out: Column[] = JSON.parse(JSON.stringify(cols));
      let moving: Card | null = null;
      for (const c of out) {
        const idx = c.cards.findIndex((card) => card.id === cardId);
        if (idx >= 0) {
          moving = c.cards.splice(idx, 1)[0]!;
          break;
        }
      }
      if (moving) {
        const target = out.find((c) => c.id === toColId);
        if (target) target.cards.push(moving);
      }
      return out;
    });
    const res = await fetch(`/api/kanban/cards/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columnId: toColId }),
    });
    if (!res.ok) {
      alert("Falha ao mover card");
      void load();
    }
  }

  const totalCards = columns.reduce((acc, c) => acc + c.cards.length, 0);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* HEADER */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 lg:px-8 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Pipeline
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Arraste cards entre colunas · {columns.length} colunas · {totalCards} cards
          </p>
        </div>
        <Button onClick={() => setColumnModal({ mode: "create" })}>
          <span className="flex items-center gap-2">
            <Plus size={16} /> Nova coluna
          </span>
        </Button>
      </header>

      {/* BOARD */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        {loading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : (
          <div className="flex gap-4 h-full min-w-min">
            {columns.map((col) => {
              const wipExceeded =
                col.wipLimit !== null && col.cards.length > col.wipLimit;
              return (
                <div
                  key={col.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setHoverCol(col.id);
                  }}
                  onDragLeave={() => setHoverCol(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setHoverCol(null);
                    if (dragging && dragging.fromColId !== col.id) {
                      void moveCard(dragging.cardId, col.id);
                    }
                    setDragging(null);
                  }}
                  className={cn(
                    "w-72 shrink-0 flex flex-col rounded-xl border bg-white dark:bg-slate-900 transition",
                    hoverCol === col.id
                      ? "border-master-orange ring-2 ring-master-orange/20"
                      : "border-slate-200 dark:border-slate-800"
                  )}
                >
                  {/* Col header */}
                  <header className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 group">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: col.color }}
                    />
                    <span className="flex-1 text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {col.name}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded",
                        wipExceeded
                          ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      )}
                    >
                      {col.cards.length}
                      {col.wipLimit !== null && `/${col.wipLimit}`}
                    </span>
                    <ColumnMenu
                      onEdit={() => setColumnModal({ mode: "edit", column: col })}
                      onDelete={() => setDeleteColModal(col)}
                    />
                  </header>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {col.cards.length === 0 ? (
                      <div className="text-center text-xs text-slate-400 py-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                        Sem cards
                      </div>
                    ) : (
                      col.cards.map((card) => (
                        <article
                          key={card.id}
                          draggable
                          onDragStart={() =>
                            setDragging({ cardId: card.id, fromColId: col.id })
                          }
                          onDragEnd={() => setDragging(null)}
                          className={cn(
                            "rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 p-3 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-master-orange/50 transition group",
                            dragging?.cardId === card.id && "opacity-40"
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <GripVertical
                              size={14}
                              className="text-slate-300 dark:text-slate-600 mt-0.5 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <h3
                                onClick={() =>
                                  setCardModal({
                                    mode: "edit",
                                    columnId: col.id,
                                    card,
                                  })
                                }
                                className="text-sm font-medium text-slate-900 dark:text-white truncate cursor-pointer hover:text-master-orange transition"
                              >
                                {card.title}
                              </h3>
                              {card.conversation && (
                                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                  {card.conversation.lastMessage ??
                                    card.conversation.contact.phone}
                                </p>
                              )}
                              {card.notes && (
                                <p className="text-xs text-slate-400 mt-1 italic line-clamp-2">
                                  {card.notes}
                                </p>
                              )}
                              <div className="flex items-center justify-between mt-2 gap-2">
                                {card.conversation ? (
                                  <Link
                                    href={`/conversations?id=${card.conversation.id}`}
                                    className="text-xs text-master-orange hover:underline flex items-center gap-1 font-medium"
                                  >
                                    <ExternalLink size={11} /> conversa
                                  </Link>
                                ) : (
                                  <span className="text-xs text-slate-400">—</span>
                                )}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                  <button
                                    onClick={() =>
                                      setCardModal({
                                        mode: "edit",
                                        columnId: col.id,
                                        card,
                                      })
                                    }
                                    className="text-slate-400 hover:text-master-orange transition p-1"
                                    title="Editar"
                                  >
                                    <Pencil size={12} />
                                  </button>
                                  <button
                                    onClick={() => setDeleteCardModal(card)}
                                    className="text-slate-400 hover:text-red-500 transition p-1"
                                    title="Apagar"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))
                    )}
                  </div>

                  {/* Add card button (fixed bottom of column) */}
                  <button
                    onClick={() =>
                      setCardModal({ mode: "create", columnId: col.id })
                    }
                    className="m-2 mt-0 flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 hover:border-master-orange hover:text-master-orange text-slate-400 text-xs font-medium transition"
                  >
                    <Plus size={14} /> Adicionar card
                  </button>
                </div>
              );
            })}

            {/* + nova coluna no fim */}
            <button
              onClick={() => setColumnModal({ mode: "create" })}
              className="w-72 shrink-0 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-master-orange hover:text-master-orange text-slate-400 transition flex items-center justify-center gap-2 text-sm font-medium"
            >
              <Plus size={16} /> Nova coluna
            </button>
          </div>
        )}
      </div>

      {/* MODALS */}
      {columnModal && (
        <ColumnFormModal
          mode={columnModal.mode}
          column={columnModal.column}
          onClose={() => setColumnModal(null)}
          onSaved={() => {
            setColumnModal(null);
            void load();
          }}
        />
      )}
      {deleteColModal && (
        <ConfirmDeleteModal
          title="Apagar coluna"
          description={`Apagar coluna "${deleteColModal.name}"${
            deleteColModal.cards.length > 0
              ? ` e seus ${deleteColModal.cards.length} card(s)`
              : ""
          }? Acao irreversivel.`}
          onClose={() => setDeleteColModal(null)}
          onConfirm={async () => {
            await fetch(`/api/kanban/columns/${deleteColModal.id}`, {
              method: "DELETE",
            });
            setDeleteColModal(null);
            void load();
          }}
        />
      )}
      {cardModal && (
        <CardFormModal
          mode={cardModal.mode}
          columnId={cardModal.columnId}
          card={cardModal.card}
          columns={columns}
          onClose={() => setCardModal(null)}
          onSaved={() => {
            setCardModal(null);
            void load();
          }}
        />
      )}
      {deleteCardModal && (
        <ConfirmDeleteModal
          title="Apagar card"
          description={`Remover card "${deleteCardModal.title}" do pipeline?`}
          onClose={() => setDeleteCardModal(null)}
          onConfirm={async () => {
            await fetch(`/api/kanban/cards/${deleteCardModal.id}`, {
              method: "DELETE",
            });
            setDeleteCardModal(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function ColumnMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded transition"
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-10 py-1 text-sm">
          <button
            onClick={onEdit}
            className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <Pencil size={12} /> Editar
          </button>
          <button
            onClick={onDelete}
            className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
          >
            <Trash2 size={12} /> Apagar
          </button>
        </div>
      )}
    </div>
  );
}

function ColumnFormModal({
  mode,
  column,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  column?: Column;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(column?.name ?? "");
  const [color, setColor] = useState(column?.color ?? "#94a3b8");
  const [wipLimit, setWipLimit] = useState<string>(
    column?.wipLimit !== null && column?.wipLimit !== undefined
      ? String(column.wipLimit)
      : ""
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const body = {
      name: name.trim(),
      color,
      wipLimit: wipLimit ? parseInt(wipLimit, 10) : null,
    };
    const url =
      mode === "create" ? "/api/kanban/columns" : `/api/kanban/columns/${column!.id}`;
    const res = await fetch(url, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) onSaved();
    else alert("Erro ao salvar coluna");
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "create" ? "Nova coluna" : "Editar coluna"}
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
        <div>
          <Label>Nome</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex: Lead, Em contato..."
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
                  "w-7 h-7 rounded-full transition border-2",
                  color === c
                    ? "border-slate-900 dark:border-white scale-110"
                    : "border-transparent"
                )}
              />
            ))}
          </div>
        </div>
        <div>
          <Label>Limite WIP (opcional)</Label>
          <Input
            type="number"
            min={1}
            value={wipLimit}
            onChange={(e) => setWipLimit(e.target.value)}
            placeholder="vazio = sem limite"
          />
          <p className="text-[10px] text-slate-500 mt-1">
            Avisa visualmente se cards na coluna ultrapassar o limite.
          </p>
        </div>
      </div>
    </Modal>
  );
}

function CardFormModal({
  mode,
  columnId,
  card,
  columns,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  columnId: string;
  card?: Card;
  columns: Column[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(card?.title ?? "");
  const [notes, setNotes] = useState(card?.notes ?? "");
  const [selectedCol, setSelectedCol] = useState(columnId);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (mode === "create") {
        const res = await fetch("/api/kanban/cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            columnId: selectedCol,
            title: title.trim(),
            notes: notes.trim() || undefined,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Erro");
      } else {
        const res = await fetch(`/api/kanban/cards/${card!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            notes: notes.trim() || null,
            columnId: selectedCol,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Erro");
      }
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "create" ? "Novo card" : "Editar card"}
      description={card?.conversation ? `Vinculado a ${card.conversation.contact.name}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || !title.trim()}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>Titulo</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ex: Joao Silva - PP"
            autoFocus
          />
        </div>
        <div>
          <Label>Coluna</Label>
          <select
            value={selectedCol}
            onChange={(e) => setSelectedCol(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-master-orange"
          >
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Notas (opcional)</Label>
          <Textarea
            rows={3}
            value={notes ?? ""}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observacoes internas, follow-ups, etc."
          />
        </div>
      </div>
    </Modal>
  );
}

function ConfirmDeleteModal({
  title,
  description,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              setLoading(true);
              await onConfirm();
              setLoading(false);
            }}
            disabled={loading}
          >
            {loading ? "Apagando..." : "Apagar"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>
    </Modal>
  );
}
