"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, MoreVertical, ExternalLink, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/cn";

interface Card {
  id: string;
  title: string;
  notes: string | null;
  order: number;
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

export default function PipelineClient() {
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<{ cardId: string; fromColId: string } | null>(null);
  const [hoverCol, setHoverCol] = useState<string | null>(null);

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
    // Optimistic: move localmente primeiro
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

  async function addColumn() {
    const name = prompt("Nome da nova coluna:");
    if (!name?.trim()) return;
    const res = await fetch("/api/kanban/columns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) void load();
  }

  async function renameColumn(col: Column) {
    const name = prompt("Renomear coluna:", col.name);
    if (!name?.trim() || name === col.name) return;
    await fetch(`/api/kanban/columns/${col.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    void load();
  }

  async function deleteColumn(col: Column) {
    if (col.cards.length > 0) {
      if (!confirm(`Coluna tem ${col.cards.length} card(s). Apagar tudo?`)) return;
    } else if (!confirm("Apagar esta coluna?")) return;
    await fetch(`/api/kanban/columns/${col.id}`, { method: "DELETE" });
    void load();
  }

  async function deleteCard(cardId: string) {
    if (!confirm("Remover este card do pipeline?")) return;
    await fetch(`/api/kanban/cards/${cardId}`, { method: "DELETE" });
    void load();
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* HEADER */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 lg:px-8 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Pipeline
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Arraste cards entre colunas. Total:{" "}
            {columns.reduce((acc, c) => acc + c.cards.length, 0)} cards
          </p>
        </div>
        <button
          onClick={addColumn}
          className="flex items-center gap-2 rounded-lg bg-master-orange hover:bg-master-orange-600 text-white text-sm font-medium px-3 py-2 transition shadow-sm"
        >
          <Plus size={16} /> Nova coluna
        </button>
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
                  <header className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: col.color }}
                    />
                    <button
                      onClick={() => renameColumn(col)}
                      className="flex-1 text-left text-sm font-semibold text-slate-900 dark:text-white hover:underline truncate"
                    >
                      {col.name}
                    </button>
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
                    <button
                      onClick={() => deleteColumn(col)}
                      className="text-slate-400 hover:text-red-500 transition"
                      title="Apagar coluna"
                    >
                      <MoreVertical size={14} />
                    </button>
                  </header>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {col.cards.length === 0 ? (
                      <div className="text-center text-xs text-slate-400 py-8">
                        Arraste cards aqui
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
                            "rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 p-3 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-master-orange/50 transition",
                            dragging?.cardId === card.id && "opacity-40"
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <GripVertical
                              size={14}
                              className="text-slate-300 dark:text-slate-600 mt-0.5 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-medium text-slate-900 dark:text-white truncate">
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
                              <div className="flex items-center justify-between mt-2">
                                {card.conversation ? (
                                  <Link
                                    href={`/conversations?id=${card.conversation.id}`}
                                    className="text-xs text-master-orange hover:underline flex items-center gap-1 font-medium"
                                  >
                                    <ExternalLink size={11} /> abrir
                                  </Link>
                                ) : (
                                  <span className="text-xs text-slate-400">
                                    sem conversa
                                  </span>
                                )}
                                <button
                                  onClick={() => deleteCard(card.id)}
                                  className="text-slate-400 hover:text-red-500 transition"
                                  title="Apagar"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
            {/* + nova coluna no fim */}
            <button
              onClick={addColumn}
              className="w-72 shrink-0 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-master-orange hover:text-master-orange text-slate-400 transition flex items-center justify-center gap-2 text-sm font-medium"
            >
              <Plus size={16} /> Adicionar coluna
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
