"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getPusherClient, disconnectPusher } from "@/lib/pusher-client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  RefreshCw,
  Plus,
  Search,
  Send,
  MessagesSquare,
  Paperclip,
  Zap,
  ChevronLeft,
  Info,
  Image as ImageIcon,
  Mic,
  Video,
  FileText,
  Smile,
  MapPin,
  Contact as ContactIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ConversationPanel } from "./ConversationPanel";
import { MessageMedia } from "@/components/MessageMedia";
import { WhatsAppText } from "@/components/WhatsAppText";
import { LogoMark } from "@/components/Logo";
import { useToast } from "@/components/Toast";
import { compressImage } from "@/lib/compress";

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
  mediaBase64?: string | null;
  mediaUrl?: string | null;
  fileName?: string | null;
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
  const [uploading, setUploading] = useState(false);
  const [quickReplies, setQuickReplies] = useState<{ id: string; title: string; content: string }[]>([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [mobileShowPanel, setMobileShowPanel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    fetch("/api/quick-replies")
      .then((r) => r.json())
      .then((d) => setQuickReplies(d.items ?? []))
      .catch(() => null);
  }, []);

  useEffect(() => {
    setShowQuickReplies(input.startsWith("/") && quickReplies.length > 0);
  }, [input, quickReplies.length]);

  const filteredQuickReplies = useMemo(() => {
    if (!showQuickReplies) return [];
    const q = input.slice(1).toLowerCase().trim();
    return quickReplies
      .filter(
        (qr) =>
          !q ||
          qr.title.toLowerCase().includes(q) ||
          qr.content.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [showQuickReplies, input, quickReplies]);

  function applyQuickReply(qr: { content: string }) {
    setInput(qr.content);
    setShowQuickReplies(false);
  }

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
    channel.bind(
      "message:new",
      (payload: { conversationId?: string }) => {
        void loadConversations();
        // Fallback: se a conversa que tem mensagem nova esta aberta,
        // recarrega tambem as mensagens (caso o canal especifico esteja stale)
        if (payload.conversationId && payload.conversationId === activeId) {
          void loadMessages(activeId);
        }
      }
    );
    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`private-workspace-${workspaceId}`);
    };
  }, [workspaceId, loadConversations, activeId, loadMessages]);

  // Polling de seguranca: se a aba ficar inativa por muito tempo o Pusher
  // pode dropar a conexao. Quando a aba volta a ser visivel, recarrega tudo.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void loadConversations();
        if (activeId) void loadMessages(activeId);
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [activeId, loadConversations, loadMessages]);

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

  async function handleFileUpload(file: File) {
    if (!activeId || uploading) return;
    setUploading(true);
    try {
      // Comprime imagens (reduz tamanho do upload)
      let processed = file;
      if (file.type.startsWith("image/")) {
        try {
          processed = await compressImage(file);
        } catch {
          processed = file;
        }
      }

      if (processed.size > 15 * 1024 * 1024) {
        toast.error("Arquivo muito grande", "Maximo 15 MB. Tente comprimir antes.");
        return;
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(processed);
      });

      const mediaType: "image" | "video" | "audio" | "document" = processed.type.startsWith("image/")
        ? "image"
        : processed.type.startsWith("video/")
          ? "video"
          : processed.type.startsWith("audio/")
            ? "audio"
            : "document";

      const res = await fetch(`/api/conversations/${activeId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaType,
          mediaDataUrl: dataUrl,
          fileName: processed.name,
          caption: input.trim() || undefined,
        }),
      });
      if (res.ok) {
        setInput("");
        if (processed.size < file.size) {
          toast.success(
            "Arquivo enviado",
            `Imagem otimizada: ${(file.size / 1024 / 1024).toFixed(1)}MB -> ${(processed.size / 1024 / 1024).toFixed(1)}MB`
          );
        } else {
          toast.success("Arquivo enviado");
        }
      } else {
        const data = await res.json();
        toast.error("Falha ao enviar", data.error ?? "Tente novamente");
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="h-full flex bg-slate-100 dark:bg-slate-950 min-w-0 overflow-hidden">
      {/* COLUNA: Lista de conversas
          Mobile: visível só quando nenhuma conversa selecionada
          Desktop: sempre visível, largura fixa */}
      <section
        className={cn(
          "bg-white dark:bg-slate-900 md:border-r border-slate-200 dark:border-slate-800 flex flex-col min-w-0",
          "md:w-96 md:shrink-0",
          activeId ? "hidden md:flex w-full" : "flex w-full md:w-96"
        )}
      >
        <header className="px-4 md:px-5 py-3 md:py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
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
                  <div className="flex items-center justify-between mt-0.5 gap-2">
                    <span className="text-sm text-slate-500 truncate flex items-center gap-1.5 min-w-0">
                      <LastMessagePreview text={c.lastMessage} />
                    </span>
                    {c.unreadCount > 0 && (
                      <span className="bg-master-orange text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 shrink-0 min-w-[20px] text-center">
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

      {/* COLUNA: Chat ativo
          Mobile: visível só quando há conversa selecionada
          Desktop: sempre visível, flex-1 */}
      <section
        className={cn(
          "flex-1 min-w-0 flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden",
          activeId ? "flex" : "hidden md:flex"
        )}
      >
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-6 p-8">
            <div className="max-w-md w-full text-center space-y-6">
              {/* Logo Master grande */}
              <div className="flex justify-center opacity-90">
                <LogoMark variant="orange" size="lg" className="w-24 h-24" />
              </div>

              {/* Texto */}
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Master CRM
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Selecione uma conversa na lista ao lado para visualizar as
                  mensagens e responder.
                </p>
              </div>

              {/* Dica visual */}
              <div className="inline-flex items-center gap-2 text-xs text-slate-400 px-3 py-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-full">
                <MessagesSquare size={12} />
                Aguardando mensagens em tempo real
              </div>
            </div>
          </div>
        ) : (
          <>
            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 md:px-6 py-3 flex items-center gap-2 md:gap-3">
              {/* Voltar (mobile only) */}
              <button
                onClick={() => setActiveId(null)}
                className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition shrink-0"
                aria-label="Voltar"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-master-orange/10 text-master-orange flex items-center justify-center text-sm font-bold shrink-0">
                {active.contact.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-slate-900 dark:text-white truncate">
                    {active.contact.name}
                  </h2>
                  <StatusBadge status={active.status} />
                </div>
                <p className="text-xs text-slate-500 truncate">{active.contact.phone}</p>
              </div>
              {/* Info button mobile -> abre painel direito */}
              <button
                onClick={() => setMobileShowPanel(true)}
                className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition shrink-0"
                aria-label="Detalhes"
              >
                <Info size={18} />
              </button>
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
                  "hidden md:inline-block text-xs font-medium px-3 py-1.5 rounded-lg border transition",
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
                  "hidden md:inline-block text-xs font-medium px-3 py-1.5 rounded-lg border transition",
                  active.status === "resolved"
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                )}
              >
                {active.status === "resolved" ? "Resolvida" : "Resolver"}
              </button>
            </header>

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-6 space-y-2">
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
                      "max-w-[80%] sm:max-w-[70%] md:max-w-lg rounded-2xl px-4 py-2 shadow-sm min-w-0",
                      m.direction === "out"
                        ? "bg-master-orange text-white"
                        : "bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    )}
                  >
                    {m.type !== "text" && m.type !== "unknown" ? (
                      <MessageMedia
                        type={m.type}
                        mediaBase64={m.mediaBase64}
                        mediaUrl={m.mediaUrl}
                        fileName={m.fileName}
                        content={m.content}
                        outgoing={m.direction === "out"}
                      />
                    ) : (
                      <div className="text-sm whitespace-pre-wrap break-words">
                        <WhatsAppText text={m.content} />
                      </div>
                    )}
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

            {/* Autocomplete de Quick Replies (aparece quando digita '/') */}
            {showQuickReplies && filteredQuickReplies.length > 0 && (
              <div className="absolute bottom-[72px] left-0 right-0 mx-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-10 max-w-md">
                <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-700 flex items-center gap-1.5">
                  <Zap size={11} className="text-master-orange" />
                  Respostas rápidas
                </div>
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {filteredQuickReplies.map((qr) => (
                    <li key={qr.id}>
                      <button
                        type="button"
                        onClick={() => applyQuickReply(qr)}
                        className="w-full text-left px-3 py-2 hover:bg-master-orange/5 transition"
                      >
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {qr.title}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {qr.content}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="px-3 py-1.5 text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-700">
                  Clique pra inserir · Esc fecha
                </div>
              </div>
            )}

            <form
              onSubmit={handleSend}
              className="relative p-2 md:p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1.5 md:gap-2 min-w-0"
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFileUpload(f);
                }}
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || sending}
                className="shrink-0 p-2 md:p-2.5 rounded-full text-slate-500 hover:text-master-orange hover:bg-master-orange/10 transition disabled:opacity-50"
                title="Anexar arquivo (imagem, video, audio, doc - max 15MB)"
                aria-label="Anexar arquivo"
              >
                {uploading ? (
                  <span className="block w-5 h-5 border-2 border-master-orange border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Paperclip size={18} />
                )}
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setShowQuickReplies(false);
                }}
                placeholder={
                  uploading
                    ? "Enviando..."
                    : "Digite uma mensagem..."
                }
                disabled={sending || uploading}
                className="flex-1 min-w-0 rounded-pill border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 md:px-5 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-master-orange focus:border-transparent"
              />
              <button
                type="submit"
                disabled={sending || uploading || !input.trim()}
                className="rounded-full md:rounded-pill bg-master-orange hover:bg-master-orange-600 disabled:opacity-50 text-white font-medium p-2.5 md:px-6 md:py-2.5 flex items-center gap-2 shrink-0"
                aria-label="Enviar mensagem"
              >
                <Send size={16} />
                <span className="hidden md:inline">{sending ? "..." : "Enviar"}</span>
              </button>
            </form>
          </>
        )}
      </section>

      {/* PAINEL DIREITO - detalhes da conversa
          Desktop: sempre visível ao lado
          Mobile: drawer overlay ativado pelo botão Info */}
      {active && (
        <>
          {/* Overlay mobile */}
          {mobileShowPanel && (
            <button
              onClick={() => setMobileShowPanel(false)}
              aria-label="Fechar"
              className="md:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
            />
          )}
          <div
            className={cn(
              "md:relative md:block",
              mobileShowPanel
                ? "fixed inset-y-0 right-0 z-40 w-80 max-w-[90vw]"
                : "hidden md:block"
            )}
          >
            <ConversationPanel
              conversationId={active.id}
              onChange={loadConversations}
              onClose={() => setMobileShowPanel(false)}
            />
          </div>
        </>
      )}

    </div>
  );
}

function LastMessagePreview({ text }: { text: string | null }) {
  if (!text) return <span>—</span>;

  // Detecta tipo de midia pelo texto que salvamos (extractContent gera essas marcas)
  const tagMatch = text.match(/^\[(\w+)\]/);
  if (tagMatch) {
    const tag = tagMatch[1]!.toLowerCase();
    const rest = text.slice(tagMatch[0].length).trim();
    const config: Record<string, { icon: React.ReactNode; label: string }> = {
      imagem: { icon: <ImageIcon size={12} />, label: "Foto" },
      image: { icon: <ImageIcon size={12} />, label: "Foto" },
      video: { icon: <Video size={12} />, label: "Vídeo" },
      audio: { icon: <Mic size={12} />, label: "Áudio" },
      documento: { icon: <FileText size={12} />, label: "Documento" },
      document: { icon: <FileText size={12} />, label: "Documento" },
      sticker: { icon: <Smile size={12} />, label: "Sticker" },
      localizacao: { icon: <MapPin size={12} />, label: "Localização" },
      contato: { icon: <ContactIcon size={12} />, label: "Contato" },
    };
    const c = config[tag];
    if (c) {
      return (
        <>
          <span className="shrink-0 text-master-orange">{c.icon}</span>
          <span className="truncate">{rest || c.label}</span>
        </>
      );
    }
  }
  return <span className="truncate">{text}</span>;
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
