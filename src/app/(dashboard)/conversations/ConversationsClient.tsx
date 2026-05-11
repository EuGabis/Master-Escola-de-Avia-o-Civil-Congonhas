"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getPusherClient, disconnectPusher } from "@/lib/pusher-client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, Plus, Search, Send, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/cn";
import { ConversationPanel } from "./ConversationPanel";

type Status = "open" | "pending" | "resolved" | "all";

interface Conversation {
  id: string;
  status: string;
  unreadCount: number;
  lastMessage: string | null;
  lastMessageAt: string | null;
  contact: { id: string; name: string; phone: string; avatar: string | null };
}

interface Message {
  id: string;
  content: string;
  type: string;
  direction: "in" | "out";
  status: string;
  timestamp: string;
}

const TABS: { key: Status; label: string }[] = [
  { key: "open", label: "Abertas" },
  { key: "pending", label: "Pendentes" },
  { key: "resolved", label: "Resolvidas" },
  { key: "all", label: "Todas" },
];

export default function ConversationsClient({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("id");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [tab, setTab] = useState<Status>("open");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(initialId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    const res = await fetch(`/api/conversations/${id}/messages`);
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages);
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  // Pusher: workspace channel
  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`private-workspace-${workspaceId}`);
    channel.bind("message:new", () => void loadConversations());
    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`private-workspace-${workspaceId}`);
    };
  }, [workspaceId, loadConversations]);

  // Pusher: conversation channel
  useEffect(() => {
    if (!activeId) return;
    void loadMessages(activeId);
    // Optimistic: zera unreadCount localmente assim que abre
    setConversations((prev) =>
      prev.map((c) => (c.id === activeId ? { ...c, unreadCount: 0 } : c))
    );
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`private-conversation-${activeId}`);
    channel.bind("message:new", (msg: Message) => {
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      );
      // Mensagem nova entrou na conversa ativa: marca como lida no servidor
      // (re-GET messages zera unreadCount na API)
      if (msg.direction === "in") {
        void fetch(`/api/conversations/${activeId}/messages`).catch(() => null);
        setConversations((prev) =>
          prev.map((c) => (c.id === activeId ? { ...c, unreadCount: 0 } : c))
        );
      }
    });
    channel.bind("message:status", ({ id, status }: { id: string; status: string }) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
    });
    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`private-conversation-${activeId}`);
    };
  }, [activeId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => () => disconnectPusher(), []);

  const filtered = useMemo(() => {
    let list = conversations;
    if (tab !== "all") list = list.filter((c) => c.status === tab);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.contact.name.toLowerCase().includes(q) ||
          c.contact.phone.includes(q) ||
          (c.lastMessage ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [conversations, tab, search]);

  const counts = useMemo(() => {
    return {
      open: conversations.filter((c) => c.status === "open").length,
      pending: conversations.filter((c) => c.status === "pending").length,
      resolved: conversations.filter((c) => c.status === "resolved").length,
      all: conversations.length,
    };
  }, [conversations]);

  const active = conversations.find((c) => c.id === activeId);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !activeId || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input.trim() }),
      });
      if (res.ok) setInput("");
      else {
        const data = await res.json();
        console.error("Erro envio:", data.error);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="h-full flex bg-slate-100 dark:bg-slate-950">
      {/* COLUNA: Lista de conversas */}
      <section className="w-96 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col">
        <header className="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <h1 className="font-bold text-slate-900 dark:text-white text-lg">
            Conversas <span className="text-slate-400 text-sm">{counts[tab]}</span>
          </h1>
          <div className="flex items-center gap-1">
            <button
              onClick={loadConversations}
              className={cn(
                "p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition",
                refreshing && "animate-spin"
              )}
              title="Atualizar"
            >
              <RefreshCw size={16} />
            </button>
            <button
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
              title="Nova conversa (em breve)"
            >
              <Plus size={16} />
            </button>
          </div>
        </header>

        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm">
            <Search size={14} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversa..."
              className="flex-1 bg-transparent outline-none placeholder:text-slate-400 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="px-3 flex gap-1 border-b border-slate-100 dark:border-slate-800">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-1 text-sm py-2 font-medium relative transition",
                tab === t.key
                  ? "text-master-orange"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              {t.label}
              {tab === t.key && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-master-orange rounded-full" />
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              {search ? "Nenhum resultado." : "Nenhuma conversa nessa aba."}
            </div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition flex gap-3",
                  activeId === c.id &&
                    "bg-master-orange-50 dark:bg-master-orange-900/10 border-l-4 border-l-master-orange"
                )}
              >
                <div className="w-10 h-10 rounded-full bg-master-orange/10 text-master-orange flex items-center justify-center text-sm font-bold shrink-0">
                  {c.contact.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900 dark:text-white truncate">
                      {c.contact.name}
                    </span>
                    {c.lastMessageAt && (
                      <span className="text-[10px] text-slate-400 ml-2 shrink-0">
                        {formatDistanceToNow(new Date(c.lastMessageAt), {
                          locale: ptBR,
                          addSuffix: false,
                        })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-sm text-slate-500 truncate">
                      {c.lastMessage ?? "—"}
                    </span>
                    {c.unreadCount > 0 && (
                      <span className="bg-master-orange text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 ml-2 min-w-[20px] text-center">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      {/* COLUNA: Chat ativo */}
      <section className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950">
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
            <div className="w-16 h-16 rounded-full bg-master-orange/10 text-master-orange flex items-center justify-center">
              <MessagesSquare size={28} />
            </div>
            <div className="text-center">
              <p className="font-medium text-slate-700 dark:text-slate-300">
                Selecione uma conversa
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Escolha uma conversa da lista para comecar
              </p>
            </div>
          </div>
        ) : (
          <>
            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-master-orange/10 text-master-orange flex items-center justify-center text-sm font-bold">
                {active.contact.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-slate-900 dark:text-white truncate">
                    {active.contact.name}
                  </h2>
                  <StatusBadge status={active.status} />
                </div>
                <p className="text-xs text-slate-500">{active.contact.phone}</p>
              </div>
              <button
                onClick={async () => {
                  await fetch(`/api/conversations/${active.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      status: active.status === "pending" ? "open" : "pending",
                    }),
                  });
                  void loadConversations();
                }}
                className={cn(
                  "text-xs font-medium px-3 py-1.5 rounded-lg border transition",
                  active.status === "pending"
                    ? "bg-amber-500 text-white border-amber-500"
                    : "border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                )}
              >
                Pendente
              </button>
              <button
                onClick={async () => {
                  await fetch(`/api/conversations/${active.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      status: active.status === "resolved" ? "open" : "resolved",
                    }),
                  });
                  void loadConversations();
                }}
                className={cn(
                  "text-xs font-medium px-3 py-1.5 rounded-lg border transition",
                  active.status === "resolved"
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                )}
              >
                {active.status === "resolved" ? "Resolvida" : "Resolver"}
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-2">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex",
                    m.direction === "out" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-lg rounded-2xl px-4 py-2 shadow-sm",
                      m.direction === "out"
                        ? "bg-master-orange text-white"
                        : "bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    )}
                  >
                    <div className="text-sm whitespace-pre-wrap break-words">
                      {m.content}
                    </div>
                    <div
                      className={cn(
                        "text-[10px] mt-1",
                        m.direction === "out"
                          ? "text-master-orange-100"
                          : "text-slate-400"
                      )}
                    >
                      {new Date(m.timestamp).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {m.direction === "out" && ` · ${m.status}`}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={handleSend}
              className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Digite uma mensagem..."
                disabled={sending}
                className="flex-1 rounded-pill border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-5 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-master-orange focus:border-transparent"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="rounded-pill bg-master-orange hover:bg-master-orange-600 disabled:opacity-50 text-white font-medium px-6 flex items-center gap-2"
              >
                <Send size={16} />
                {sending ? "..." : "Enviar"}
              </button>
            </form>
          </>
        )}
      </section>

      {/* PAINEL DIREITO - detalhes da conversa */}
      {active && (
        <ConversationPanel
          conversationId={active.id}
          onChange={loadConversations}
        />
      )}

    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map = {
    open: { label: "Aberta", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" },
    pending: { label: "Pendente", color: "bg-amber-500/15 text-amber-600 dark:text-amber-300" },
    resolved: { label: "Resolvida", color: "bg-slate-300/30 text-slate-600 dark:text-slate-400" },
    snoozed: { label: "Adiada", color: "bg-blue-500/15 text-blue-600 dark:text-blue-300" },
  } as const;
  const s = map[status as keyof typeof map] ?? map.open;
  return (
    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wider", s.color)}>
      {s.label}
    </span>
  );
}
