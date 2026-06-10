"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Pencil,
  Trash2,
  MessageSquare,
  Users,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Modal, Button, Input, Textarea, Label } from "@/components/Modal";
import { useToast, useConfirm } from "@/components/Toast";
import { ContactDetailModal } from "./ContactDetailModal";
import { cn } from "@/lib/cn";

interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  courseInterest: string | null;
  source: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count: { conversations: number };
}

const COURSES = ["PP", "PC", "Comissario", "INVA", "outro"];
const SOURCES = ["website", "indicacao", "instagram", "google", "outro"];
const STATUS = [
  { key: "lead", label: "Lead", color: "bg-blue-500" },
  { key: "aluno", label: "Aluno", color: "bg-emerald-500" },
  { key: "ex_aluno", label: "Ex-aluno", color: "bg-slate-400" },
  { key: "perdido", label: "Perdido", color: "bg-red-500" },
];

export default function ContatosClient() {
  const toast = useToast();
  const confirm = useConfirm();

  const [items, setItems] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const limit = 30;
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [hasConvFilter, setHasConvFilter] = useState("");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ mode: "create" | "edit"; contact?: Contact } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  // Debounce da busca
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (debouncedQ) params.set("q", debouncedQ);
    if (statusFilter) params.set("status", statusFilter);
    if (courseFilter) params.set("courseInterest", courseFilter);
    if (hasConvFilter) params.set("hasConversation", hasConvFilter);
    const res = await fetch(`/api/contacts?${params}`);
    const data = await res.json();
    setItems(data.items ?? []);
    setTotal(data.total ?? 0);
    setPages(data.pages ?? 0);
    setSelected(new Set());
    setLoading(false);
  }, [page, debouncedQ, statusFilter, courseFilter, hasConvFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Volta pra pagina 0 ao mudar filtros
  useEffect(() => {
    setPage(0);
  }, [debouncedQ, statusFilter, courseFilter, hasConvFilter]);

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }
  function selectAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((c) => c.id)));
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    const ok = await confirm({
      title: `Apagar ${selected.size} contato(s)?`,
      description:
        "Esta ação remove os contatos e suas conversas relacionadas. Não pode ser desfeita.",
      variant: "danger",
      confirmText: "Apagar tudo",
    });
    if (!ok) return;
    const res = await fetch("/api/contacts/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", ids: Array.from(selected) }),
    });
    if (res.ok) {
      const data = await res.json();
      toast.success(`${data.deleted} contato(s) removido(s)`);
      void load();
    } else {
      toast.error("Falha ao apagar");
    }
  }

  async function handleExport() {
    window.open("/api/contacts/export", "_blank");
    toast.info("Exportação iniciada", "O download começará em instantes");
  }

  const [syncingNames, setSyncingNames] = useState(false);
  async function handleSyncNames() {
    if (syncingNames) return;
    setSyncingNames(true);
    try {
      const res = await fetch("/api/contacts/sync-names", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(
          "Falha ao sincronizar",
          data?.details ?? data?.error ?? "Erro desconhecido"
        );
        return;
      }
      const s = data.summary ?? {};
      toast.success(
        "Nomes sincronizados",
        `Atualizados: ${s.atualizados ?? 0}, Já corretos: ${s.jaIguais ?? 0}, Sem WA: ${s.semCorrespondencia ?? 0}`
      );
      void load();
    } catch (err) {
      toast.error("Erro de rede", err instanceof Error ? err.message : String(err));
    } finally {
      setSyncingNames(false);
    }
  }

  async function handleStartChat(contactId: string) {
    const res = await fetch(`/api/contacts/${contactId}/start-conversation`, {
      method: "POST",
    });
    const data = await res.json();
    if (data.conversationId) {
      window.location.href = `/conversations?id=${data.conversationId}`;
    } else {
      toast.error("Falha ao abrir conversa");
    }
  }

  const hasFilters = useMemo(
    () => !!(debouncedQ || statusFilter || courseFilter || hasConvFilter),
    [debouncedQ, statusFilter, courseFilter, hasConvFilter]
  );

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 md:py-5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">
              Contatos
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {total.toLocaleString("pt-BR")} contato(s)
              {hasFilters && " encontrado(s)"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            <Button
              variant="ghost"
              onClick={handleSyncNames}
              disabled={syncingNames}
              title="Atualizar nomes dos contatos pelo WhatsApp"
            >
              <span className="flex items-center gap-2">
                <RefreshCw
                  size={14}
                  className={syncingNames ? "animate-spin" : ""}
                />
                <span className="hidden md:inline">
                  {syncingNames ? "Sincronizando..." : "Sincronizar nomes"}
                </span>
              </span>
            </Button>
            <Button variant="ghost" onClick={() => setImporting(true)} title="Importar">
              <span className="flex items-center gap-2">
                <Upload size={14} /> <span className="hidden md:inline">Importar</span>
              </span>
            </Button>
            <Button variant="ghost" onClick={handleExport} title="Exportar">
              <span className="flex items-center gap-2">
                <Download size={14} /> <span className="hidden md:inline">Exportar</span>
              </span>
            </Button>
            <Button onClick={() => setEditing({ mode: "create" })} title="Novo contato">
              <span className="flex items-center gap-2">
                <Plus size={14} /> <span className="hidden sm:inline">Novo contato</span>
              </span>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 md:py-6 space-y-4">
        {/* BUSCA + FILTROS */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
          <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, telefone ou email..."
              className="flex-1 bg-transparent outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 sm:flex sm:items-center gap-2 sm:contents">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white min-w-0"
            >
              <option value="">Status</option>
              {STATUS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white min-w-0"
            >
              <option value="">Curso</option>
              {COURSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={hasConvFilter}
              onChange={(e) => setHasConvFilter(e.target.value)}
              className="text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white min-w-0"
            >
              <option value="">Convs</option>
              <option value="yes">Com</option>
              <option value="no">Sem</option>
            </select>
          </div>
          {hasFilters && (
            <button
              onClick={() => {
                setQ("");
                setStatusFilter("");
                setCourseFilter("");
                setHasConvFilter("");
              }}
              className="text-xs text-master-orange hover:underline px-2"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* BULK ACTIONS */}
        {selected.size > 0 && (
          <div className="bg-master-orange/10 border border-master-orange/30 rounded-xl px-4 py-2 flex items-center justify-between animate-fade-in">
            <span className="text-sm text-slate-900 dark:text-white">
              <strong>{selected.size}</strong> selecionado(s)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs text-slate-600 dark:text-slate-300 hover:text-master-orange"
              >
                Limpar
              </button>
              <Button variant="danger" onClick={handleBulkDelete}>
                <span className="flex items-center gap-2 text-xs">
                  <Trash2 size={12} /> Apagar selecionados
                </span>
              </Button>
            </div>
          </div>
        )}

        {/* TABELA */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">
              Carregando...
            </div>
          ) : items.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-14 h-14 rounded-full bg-master-orange/10 text-master-orange flex items-center justify-center mx-auto mb-3">
                <Users size={24} />
              </div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {hasFilters ? "Nenhum contato encontrado" : "Sem contatos ainda"}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {hasFilters
                  ? "Tente ajustar os filtros ou limpar a busca"
                  : "Crie um manualmente ou importe um CSV"}
              </p>
            </div>
          ) : (
            <>
              <div className="hidden md:grid grid-cols-[40px_2fr_1fr_120px_100px_60px_60px] gap-3 px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:border-slate-800 font-semibold bg-slate-50 dark:bg-slate-800/50">
                <div>
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selected.size === items.length}
                    onChange={selectAll}
                    className="rounded text-master-orange focus:ring-master-orange"
                  />
                </div>
                <div>Contato</div>
                <div>Telefone</div>
                <div>Curso</div>
                <div>Status</div>
                <div className="text-center">Convs</div>
                <div></div>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((c) => (
                  <ContactRow
                    key={c.id}
                    contact={c}
                    selected={selected.has(c.id)}
                    onToggle={() => toggleSelect(c.id)}
                    onEdit={() => setEditing({ mode: "edit", contact: c })}
                    onDetail={() => setDetailId(c.id)}
                    onChat={() => handleStartChat(c.id)}
                  />
                ))}
              </div>

              {/* PAGINACAO */}
              {pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-sm">
                  <span className="text-slate-500">
                    Página {page + 1} de {pages}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition text-slate-600 dark:text-slate-300"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                      disabled={page >= pages - 1}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition text-slate-600 dark:text-slate-300"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* MODAIS */}
      {editing && (
        <ContactFormModal
          mode={editing.mode}
          contact={editing.contact}
          onClose={() => setEditing(null)}
          onSaved={(c) => {
            setEditing(null);
            toast.success(
              editing.mode === "create" ? "Contato criado" : "Contato atualizado",
              c.name
            );
            void load();
          }}
        />
      )}

      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onDone={(result) => {
            setImporting(false);
            toast.success(
              "Importação concluída",
              `${result.created} criados · ${result.updated} atualizados · ${result.skipped} ignorados`
            );
            void load();
          }}
        />
      )}

      {detailId && (
        <ContactDetailModal
          contactId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={(c) => {
            setDetailId(null);
            setEditing({
              mode: "edit",
              contact: {
                ...c,
                _count: { conversations: c.conversations.length },
              },
            });
          }}
          onChat={(c) => {
            setDetailId(null);
            handleStartChat(c.id);
          }}
          onDeleted={() => {
            setDetailId(null);
            toast.success("Contato removido");
            void load();
          }}
        />
      )}
    </div>
  );
}

function ContactRow({
  contact,
  selected,
  onToggle,
  onEdit,
  onDetail,
  onChat,
}: {
  contact: Contact;
  selected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDetail: () => void;
  onChat: () => void;
}) {
  const status = STATUS.find((s) => s.key === contact.status);
  return (
    <div
      className={cn(
        "flex md:grid md:grid-cols-[40px_2fr_1fr_120px_100px_60px_60px] gap-3 px-4 py-3 md:py-2.5 items-start md:items-center hover:bg-slate-50 dark:hover:bg-slate-800/30 transition group",
        selected && "bg-master-orange/5"
      )}
    >
      <div className="pt-1 md:pt-0">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="rounded text-master-orange focus:ring-master-orange"
        />
      </div>
      <button
        onClick={onDetail}
        className="flex-1 md:flex-initial flex items-start md:items-center gap-3 min-w-0 text-left"
      >
        <div className="w-9 h-9 md:w-8 md:h-8 rounded-full bg-master-orange/10 text-master-orange flex items-center justify-center text-sm md:text-xs font-bold shrink-0">
          {contact.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-slate-900 dark:text-white truncate text-sm group-hover:text-master-orange transition">
            {contact.name}
          </div>
          {/* Mobile: empilha email + phone + badges no card */}
          <div className="md:hidden text-xs text-slate-500 font-mono mt-0.5">
            {contact.phone}
          </div>
          {contact.email && (
            <div className="text-[10px] text-slate-500 truncate">
              {contact.email}
            </div>
          )}
          <div className="md:hidden flex items-center gap-2 mt-1.5 flex-wrap">
            {status && (
              <span className="inline-flex items-center gap-1.5 text-xs">
                <span className={cn("w-2 h-2 rounded-full", status.color)} />
                <span className="text-slate-700 dark:text-slate-300">{status.label}</span>
              </span>
            )}
            {contact.courseInterest && (
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300 font-semibold">
                {contact.courseInterest}
              </span>
            )}
            {contact._count.conversations > 0 && (
              <span className="text-[10px] text-slate-500">
                {contact._count.conversations} {contact._count.conversations === 1 ? "conv." : "convs."}
              </span>
            )}
          </div>
        </div>
      </button>
      {/* Desktop cells */}
      <div className="hidden md:block text-sm text-slate-500 font-mono truncate">
        {contact.phone}
      </div>
      <div className="hidden md:block text-xs">
        {contact.courseInterest ? (
          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
            {contact.courseInterest}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </div>
      <div className="hidden md:block">
        {status && (
          <span className="inline-flex items-center gap-1.5 text-xs">
            <span className={cn("w-2 h-2 rounded-full", status.color)} />
            <span className="text-slate-700 dark:text-slate-300">
              {status.label}
            </span>
          </span>
        )}
      </div>
      <div className="hidden md:block text-center text-sm text-slate-500">
        {contact._count.conversations}
      </div>
      {/* Action buttons - sempre visivel no mobile, hover no desktop */}
      <div className="flex items-center justify-end gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition">
        <button
          onClick={onChat}
          title="Abrir conversa"
          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition"
        >
          <MessageSquare size={13} />
        </button>
        <button
          onClick={onEdit}
          title="Editar"
          className="p-1.5 rounded-lg text-slate-400 hover:text-master-orange hover:bg-master-orange/10 transition"
        >
          <Pencil size={13} />
        </button>
      </div>
    </div>
  );
}

function ContactFormModal({
  mode,
  contact,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  contact?: Contact;
  onClose: () => void;
  onSaved: (c: Contact) => void;
}) {
  const [name, setName] = useState(contact?.name ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [courseInterest, setCourseInterest] = useState(
    contact?.courseInterest ?? ""
  );
  const [source, setSource] = useState(contact?.source ?? "");
  const [status, setStatus] = useState(contact?.status ?? "lead");
  const [notes, setNotes] = useState(contact?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim() || !phone.trim()) {
      setError("Nome e telefone são obrigatórios");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 8) {
      setError("Telefone inválido (mínimo 8 dígitos)");
      return;
    }
    setSaving(true);
    setError(null);
    const url = mode === "create" ? "/api/contacts" : `/api/contacts/${contact!.id}`;
    const res = await fetch(url, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        phone: cleanPhone,
        email: email.trim() || null,
        notes: notes.trim() || null,
        courseInterest: courseInterest || null,
        source: source || null,
        status,
      }),
    });
    setSaving(false);
    const data = await res.json();
    if (res.ok) onSaved(data.contact);
    else setError(data.error ?? "Erro ao salvar");
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "create" ? "Novo contato" : "Editar contato"}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>Nome completo</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="João Silva"
              autoFocus
            />
          </div>
          <div>
            <Label>Telefone (com DDI+DDD)</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5511987654321"
              className="font-mono"
            />
            <p className="text-[10px] text-slate-500 mt-1">Só números</p>
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@exemplo.com"
            />
          </div>
          <div>
            <Label>Curso de interesse</Label>
            <select
              value={courseInterest}
              onChange={(e) => setCourseInterest(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value="">— Não definido —</option>
              {COURSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Origem do lead</Label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value="">— Não definido —</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Status</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STATUS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatus(s.key)}
                  className={cn(
                    "rounded-lg border p-2 text-sm transition flex items-center gap-2 justify-center",
                    status === s.key
                      ? "border-master-orange bg-master-orange/5 text-master-orange font-semibold"
                      : "border-slate-200 dark:border-slate-700 hover:border-master-orange/50 text-slate-700 dark:text-slate-300"
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full", s.color)} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label>Notas internas</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações sobre este contato..."
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ImportModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (result: { created: number; updated: number; skipped: number; errors: string[] }) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function doImport() {
    if (!file) return;
    setImporting(true);
    setErrors([]);
    const csv = await file.text();
    const res = await fetch("/api/contacts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv }),
    });
    setImporting(false);
    const data = await res.json();
    if (res.ok) {
      onDone(data);
    } else {
      setErrors([data.error ?? "Erro"]);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Importar contatos via CSV"
      description="Upload de planilha pra criar/atualizar contatos em massa"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={doImport} disabled={!file || importing}>
            {importing ? "Importando..." : "Importar"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {errors.length > 0 && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm p-3">
            {errors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        )}

        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 p-4 text-sm">
          <p className="text-slate-700 dark:text-slate-300 font-medium mb-2">
            Formato esperado:
          </p>
          <code className="text-xs block bg-white dark:bg-slate-900 p-2 rounded font-mono text-slate-700 dark:text-slate-300">
            nome,telefone,email,curso_interesse,origem,status,notas
            <br />
            João Silva,5511999999999,joao@email.com,PP,instagram,lead,
          </code>
          <p className="text-xs text-slate-500 mt-2">
            <strong>Obrigatórios</strong>: nome, telefone (só números, com DDI).{" "}
            <strong>Status válidos</strong>: lead, aluno, ex_aluno, perdido.{" "}
            <strong>Cursos válidos</strong>: PP, PC, Comissario, INVA, outro.
            Telefones duplicados serão <strong>atualizados</strong> em vez de duplicados.
          </p>
        </div>

        <div>
          <Label>Arquivo CSV</Label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-700 dark:text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-master-orange file:text-white hover:file:bg-master-orange-600 file:cursor-pointer cursor-pointer"
          />
          {file && (
            <p className="text-xs text-slate-500 mt-1">
              {file.name} · {(file.size / 1024).toFixed(1)} KB
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
