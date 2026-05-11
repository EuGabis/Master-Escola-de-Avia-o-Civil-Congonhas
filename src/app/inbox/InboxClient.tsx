"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getPusherClient, disconnectPusher } from "@/lib/pusher-client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Logo } from "@/components/Logo";

interface Conversation {
  id: string;
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

export default function InboxClient({
  workspaceId,
  userName,
}: {
  workspaceId: string;
  userName: string;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/conversations");
    if (!res.ok) return;
    const data = await res.json();
    setConversations(data.conversations);
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    const res = await fetch(`/api/conversations/${id}/messages`);
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages);
  }, []);

  // Carrega lista inicial
  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  // Conecta Pusher e escuta o canal do workspace (novas conversas, novas mensagens)
  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`private-workspace-${workspaceId}`);
    channel.bind("message:new", () => {
      void loadConversations();
    });
    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`private-workspace-${workspaceId}`);
    };
  }, [workspaceId, loadConversations]);

  // Ao abrir uma conversa, carrega mensagens + escuta o canal dela
  useEffect(() => {
    if (!activeId) return;
    void loadMessages(activeId);

    const pusher = getPusherClient();
    const channel = pusher.subscribe(`private-conversation-${activeId}`);
    channel.bind("message:new", (msg: Message) => {
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      );
    });
    channel.bind("message:status", ({ id, status }: { id: string; status: string }) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
    });
    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`private-conversation-${activeId}`);
    };
  }, [activeId, loadMessages]);

  // Auto-scroll quando chega msg nova
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup do Pusher no unmount da pagina
  useEffect(() => {
    return () => disconnectPusher();
  }, []);

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
      if (res.ok) {
        setInput("");
      } else {
        const data = await res.json();
        alert(data.error ?? "Erro ao enviar");
      }
    } finally {
      setSending(false);
    }
  }

  const activeConv = conversations.find((c) => c.id === activeId);

  return (
    <div className="h-screen flex bg-slate-50 dark:bg-slate-900">
      {/* SIDEBAR - lista de conversas */}
      <aside className="w-80 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col">
        <header className="p-4 border-b border-slate-200 dark:border-slate-700">
          <Link href="/" className="block mb-3 hover:opacity-80 transition">
            <Logo size="sm" />
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wider">
              Conversas
            </h1>
            <span className="text-xs text-slate-500 truncate ml-2">{userName}</span>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              Nenhuma conversa ainda.
              <br />
              Aguardando mensagens chegarem...
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full text-left p-3 border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition ${
                  activeId === c.id ? "bg-master-orange-50 dark:bg-master-orange-900/20" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900 dark:text-white truncate">
                    {c.contact.name}
                  </span>
                  {c.unreadCount > 0 && (
                    <span className="bg-master-orange text-white text-xs rounded-full px-2 py-0.5 ml-2">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm text-slate-500 truncate">
                    {c.lastMessage ?? "—"}
                  </span>
                  {c.lastMessageAt && (
                    <span className="text-xs text-slate-400 ml-2 shrink-0">
                      {formatDistanceToNow(new Date(c.lastMessageAt), {
                        locale: ptBR,
                        addSuffix: false,
                      })}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* MAIN - chat ativo */}
      <main className="flex-1 flex flex-col">
        {!activeConv ? (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            Selecione uma conversa
          </div>
        ) : (
          <>
            <header className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <h2 className="font-medium text-slate-900 dark:text-white">
                {activeConv.contact.name}
              </h2>
              <p className="text-xs text-slate-500">{activeConv.contact.phone}</p>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-md rounded-2xl px-4 py-2 ${
                      m.direction === "out"
                        ? "bg-master-orange text-white"
                        : "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                    <div
                      className={`text-[10px] mt-1 ${
                        m.direction === "out"
                          ? "text-master-orange-100"
                          : "text-slate-400"
                      }`}
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
              className="p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Digite uma mensagem..."
                disabled={sending}
                className="flex-1 rounded-full border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="rounded-full bg-master-orange hover:bg-master-orange-600 disabled:opacity-50 text-white font-medium px-6"
              >
                {sending ? "..." : "Enviar"}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
