"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, MessagesSquare } from "lucide-react";
import { Modal, Button, Input, Textarea, Label } from "@/components/Modal";

interface QuickReply {
  id: string;
  title: string;
  content: string;
}

export function QuickRepliesTab() {
  const [items, setItems] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ mode: "create" | "edit"; item?: QuickReply } | null>(null);
  const [del, setDel] = useState<QuickReply | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/quick-replies");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Respostas rapidas
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Mensagens pre-prontas que voce pode inserir no chat com 1 clique
            </p>
          </div>
          <Button onClick={() => setEditing({ mode: "create" })}>
            <span className="flex items-center gap-2">
              <Plus size={14} /> Nova
            </span>
          </Button>
        </header>

        {loading ? (
          <p className="p-5 text-sm text-slate-500">Carregando...</p>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-12 h-12 rounded-full bg-master-orange/10 text-master-orange flex items-center justify-center mx-auto mb-3">
              <MessagesSquare size={20} />
            </div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Nenhuma resposta rapida ainda
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Crie textos prontos como &quot;Saudacao&quot;, &quot;Horarios&quot;,
              &quot;Como matricular&quot;, etc. Voce reutiliza no chat sem digitar de novo.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((q) => (
              <div
                key={q.id}
                className="px-5 py-3 flex items-start justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition group"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-slate-900 dark:text-white text-sm">
                    {q.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                    {q.content}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => setEditing({ mode: "edit", item: q })}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-master-orange hover:bg-master-orange/10 transition"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDel(q)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition"
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
          title="Apagar resposta rapida"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDel(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await fetch(`/api/quick-replies/${del.id}`, { method: "DELETE" });
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
            Apagar <strong>{del.title}</strong>?
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
  item?: QuickReply;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [content, setContent] = useState(item?.content ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    const url = mode === "create" ? "/api/quick-replies" : `/api/quick-replies/${item!.id}`;
    const res = await fetch(url, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), content: content.trim() }),
    });
    setSaving(false);
    if (res.ok) onSaved();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "create" ? "Nova resposta rapida" : "Editar resposta rapida"}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || !title.trim() || !content.trim()}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>Titulo (atalho)</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ex: Saudacao, Horarios..."
            autoFocus
          />
        </div>
        <div>
          <Label>Conteudo da mensagem</Label>
          <Textarea
            rows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Texto que sera inserido no chat..."
          />
        </div>
      </div>
    </Modal>
  );
}
