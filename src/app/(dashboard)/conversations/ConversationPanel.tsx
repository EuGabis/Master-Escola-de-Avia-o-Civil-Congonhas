"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Plus, Tag, X, ExternalLink, Pencil, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
}

interface Label {
  id: string;
  name: string;
  color: string;
}

interface KanbanColumn {
  id: string;
  name: string;
  color: string;
}

interface KanbanCard {
  id: string;
  column: KanbanColumn;
}

interface Assignment {
  user: { id: string; name: string; color: string; avatar: string | null };
}

interface ConversationDetails {
  id: string;
  status: string;
  aiEnabled: boolean;
  contact: Contact;
  labels: { label: Label }[];
  assignments: Assignment[];
  kanbanCard: KanbanCard | null;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
  color: string;
  isOnline: boolean;
}

export function ConversationPanel({
  conversationId,
  onChange,
}: {
  conversationId: string;
  onChange?: () => void;
}) {
  const [conv, setConv] = useState<ConversationDetails | null>(null);
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [creatingLabel, setCreatingLabel] = useState(false);

  async function load() {
    const [c, l, k, u] = await Promise.all([
      fetch(`/api/conversations/${conversationId}`).then((r) => r.json()),
      fetch("/api/labels").then((r) => r.json()),
      fetch("/api/kanban").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
    ]);
    setConv(c.conversation);
    setAllLabels(l.labels ?? []);
    setColumns((k.columns ?? []).map((col: KanbanColumn) => col));
    setUsers(u.users ?? []);
  }

  async function assignUser(userId: string | null) {
    await fetch(`/api/conversations/${conversationId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    await load();
    onChange?.();
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  async function patchConv(body: Record<string, unknown>) {
    await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await load();
    onChange?.();
  }

  async function addLabel(labelId: string) {
    await fetch(`/api/conversations/${conversationId}/labels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labelId }),
    });
    await load();
  }

  async function removeLabel(labelId: string) {
    await fetch(`/api/conversations/${conversationId}/labels?labelId=${labelId}`, {
      method: "DELETE",
    });
    await load();
  }

  async function createLabel() {
    const name = prompt("Nome da nova etiqueta:");
    if (!name?.trim()) return;
    const colors = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6"];
    setCreatingLabel(true);
    const res = await fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        color: colors[Math.floor(Math.random() * colors.length)],
      }),
    });
    const data = await res.json();
    setCreatingLabel(false);
    if (res.ok) {
      await addLabel(data.label.id);
    } else {
      alert(data.error ?? "Erro");
    }
  }

  async function addToColumn(columnId: string) {
    if (!conv) return;
    const res = await fetch("/api/kanban/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        columnId,
        conversationId: conv.id,
        title: conv.contact.name,
      }),
    });
    if (res.ok || res.status === 409) {
      // Se ja existir o card, move pra essa coluna
      if (res.status === 409 && conv.kanbanCard) {
        await fetch(`/api/kanban/cards/${conv.kanbanCard.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ columnId }),
        });
      }
      await load();
    } else {
      alert((await res.json()).error ?? "Erro");
    }
  }

  if (!conv) {
    return (
      <aside className="w-80 shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex items-center justify-center text-sm text-slate-400">
        Carregando...
      </aside>
    );
  }

  const labelIds = new Set(conv.labels.map((l) => l.label.id));
  const activeColumnId = conv.kanbanCard?.column.id;

  return (
    <aside className="w-80 shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 overflow-y-auto">
      {/* CONTATO */}
      <Section title="Contato">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-master-orange/10 text-master-orange flex items-center justify-center text-base font-bold shrink-0">
            {conv.contact.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-900 dark:text-white truncate">
              {conv.contact.name}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{conv.contact.phone}</p>
            {conv.contact.email && (
              <p className="text-xs text-slate-500 truncate">{conv.contact.email}</p>
            )}
          </div>
        </div>
      </Section>

      {/* AGENTE IA */}
      <Section title="Agente IA" icon={Bot}>
        <label className="flex items-center justify-between cursor-pointer group">
          <span className="text-sm text-slate-700 dark:text-slate-200">
            Respondendo automaticamente
          </span>
          <input
            type="checkbox"
            checked={conv.aiEnabled}
            onChange={(e) => void patchConv({ aiEnabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 rounded-full peer-checked:bg-master-orange transition relative">
            <div
              className={cn(
                "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition shadow-sm",
                conv.aiEnabled && "translate-x-4"
              )}
            />
          </div>
        </label>
        <p className="text-[10px] text-slate-400 mt-2">
          Quando ligado, o agente IA respondera automaticamente nessa conversa.
        </p>
      </Section>

      {/* STATUS */}
      <Section title="Status">
        <div className="space-y-2">
          {[
            { key: "open", label: "Aberta", color: "bg-emerald-500" },
            { key: "pending", label: "Pendente", color: "bg-amber-500" },
            { key: "resolved", label: "Resolvida", color: "bg-slate-400" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => void patchConv({ status: s.key })}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition border",
                conv.status === s.key
                  ? "border-master-orange bg-master-orange/5 text-master-orange font-semibold"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-master-orange/50"
              )}
            >
              <span className={cn("w-2 h-2 rounded-full", s.color)} />
              {s.label}
            </button>
          ))}
        </div>
      </Section>

      {/* PIPELINE */}
      <Section title="Pipeline">
        {columns.length === 0 ? (
          <p className="text-xs text-slate-400">
            Crie colunas em{" "}
            <Link href="/pipeline" className="text-master-orange hover:underline">
              /pipeline
            </Link>
          </p>
        ) : (
          <div className="space-y-1">
            {columns.map((col) => (
              <button
                key={col.id}
                onClick={() => void addToColumn(col.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition",
                  activeColumnId === col.id
                    ? "bg-master-orange/10 text-master-orange font-semibold"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                )}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: col.color }}
                />
                {col.name}
                {activeColumnId === col.id && (
                  <ExternalLink size={12} className="ml-auto" />
                )}
              </button>
            ))}
            <p className="text-[10px] text-slate-400 mt-2">
              Clique em uma coluna para adicionar / mover
            </p>
          </div>
        )}
      </Section>

      {/* RESPONSÁVEL */}
      <Section title="Responsável" icon={UserIcon}>
        {conv.assignments.length > 0 && (
          <div className="mb-2 flex items-center gap-2 bg-master-orange/5 border border-master-orange/20 rounded-lg p-2">
            <div
              style={{ backgroundColor: conv.assignments[0]!.user.color }}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            >
              {conv.assignments[0]!.user.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-slate-900 dark:text-white flex-1 truncate">
              {conv.assignments[0]!.user.name}
            </span>
            <button
              onClick={() => void assignUser(null)}
              className="text-slate-400 hover:text-red-500 transition"
              title="Remover"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <select
          value={conv.assignments[0]?.user.id ?? ""}
          onChange={(e) => void assignUser(e.target.value || null)}
          className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-master-orange"
        >
          <option value="">{conv.assignments.length > 0 ? "Trocar agente..." : "Selecionar agente..."}</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.role}){u.isOnline ? " ● online" : ""}
            </option>
          ))}
        </select>
        {conv.assignments.length === 0 && (
          <p className="text-[10px] text-slate-400 mt-1">
            Sem responsável atribuído.
          </p>
        )}
      </Section>

      {/* ETIQUETAS */}
      <Section title="Etiquetas" icon={Tag}>
        <div className="space-y-2">
          {/* aplicadas */}
          {conv.labels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {conv.labels.map(({ label }) => (
                <span
                  key={label.id}
                  className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: label.color }}
                >
                  {label.name}
                  <button
                    onClick={() => void removeLabel(label.id)}
                    className="hover:bg-white/20 rounded-full p-0.5"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* disponiveis */}
          {allLabels.filter((l) => !labelIds.has(l.id)).length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                Adicionar:
              </p>
              <div className="flex flex-wrap gap-1">
                {allLabels
                  .filter((l) => !labelIds.has(l.id))
                  .map((l) => (
                    <button
                      key={l.id}
                      onClick={() => void addLabel(l.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border transition hover:scale-105"
                      style={{
                        borderColor: l.color,
                        color: l.color,
                      }}
                    >
                      <Plus size={10} /> {l.name}
                    </button>
                  ))}
              </div>
            </div>
          )}

          <button
            onClick={createLabel}
            disabled={creatingLabel}
            className="w-full text-xs text-slate-500 hover:text-master-orange flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 hover:border-master-orange transition"
          >
            <Plus size={12} /> Nova etiqueta
          </button>
        </div>
      </Section>

      {/* NOTAS */}
      <Section title="Notas internas" icon={Pencil}>
        <NotesEditor
          contactId={conv.contact.id}
          initial={conv.contact.notes ?? ""}
        />
      </Section>
    </aside>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
      <h4 className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-3 flex items-center gap-1.5">
        {Icon && <Icon size={11} />}
        {title}
      </h4>
      {children}
    </div>
  );
}

function NotesEditor({ contactId, initial }: { contactId: string; initial: string }) {
  const [notes, setNotes] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={save}
        placeholder="Anotacoes sobre este contato..."
        rows={3}
        className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-master-orange resize-none"
      />
      <div className="text-[10px] text-slate-400 mt-1">
        {saving ? "Salvando..." : savedAt ? "Salvo" : "Salva automaticamente ao sair do campo"}
      </div>
    </div>
  );
}
