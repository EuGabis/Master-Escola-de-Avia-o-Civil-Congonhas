"use client";

import { useEffect, useState } from "react";
import { Modal, Button } from "@/components/Modal";
import { useConfirm, useToast } from "@/components/Toast";
import {
  Mail,
  Phone,
  Calendar,
  Pencil,
  MessageSquare,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { cn } from "@/lib/cn";

interface ContactFull {
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
  conversations: {
    id: string;
    status: string;
    lastMessage: string | null;
    lastMessageAt: string | null;
    unreadCount: number;
    labels: { label: { id: string; name: string; color: string } }[];
  }[];
}

export function ContactDetailModal({
  contactId,
  onClose,
  onEdit,
  onChat,
  onDeleted,
}: {
  contactId: string;
  onClose: () => void;
  onEdit: (c: ContactFull) => void;
  onChat: (c: ContactFull) => void;
  onDeleted: () => void;
}) {
  const [contact, setContact] = useState<ContactFull | null>(null);
  const confirm = useConfirm();
  const toast = useToast();

  useEffect(() => {
    fetch(`/api/contacts/${contactId}`)
      .then((r) => r.json())
      .then((d) => setContact(d.contact))
      .catch(() => null);
  }, [contactId]);

  async function handleDelete() {
    if (!contact) return;
    const ok = await confirm({
      title: `Apagar ${contact.name}?`,
      description:
        "Esta ação remove o contato e todas as conversas relacionadas. Não pode ser desfeita.",
      variant: "danger",
      confirmText: "Apagar",
    });
    if (!ok) return;
    const res = await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" });
    if (res.ok) onDeleted();
    else toast.error("Falha ao apagar");
  }

  if (!contact) {
    return (
      <Modal open onClose={onClose} title="Carregando...">
        <p className="text-sm text-slate-500">Buscando informações...</p>
      </Modal>
    );
  }

  const statusLabel = {
    lead: "Lead",
    aluno: "Aluno",
    ex_aluno: "Ex-aluno",
    perdido: "Perdido",
  }[contact.status] ?? contact.status;
  const statusColor = {
    lead: "bg-blue-500",
    aluno: "bg-emerald-500",
    ex_aluno: "bg-slate-400",
    perdido: "bg-red-500",
  }[contact.status] ?? "bg-slate-400";

  return (
    <Modal
      open
      onClose={onClose}
      title={contact.name}
      size="lg"
      footer={
        <>
          <Button variant="danger" onClick={handleDelete}>
            <span className="flex items-center gap-1.5">
              <Trash2 size={12} /> Apagar
            </span>
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={() => onEdit(contact)}>
            <span className="flex items-center gap-1.5">
              <Pencil size={12} /> Editar
            </span>
          </Button>
          <Button onClick={() => onChat(contact)}>
            <span className="flex items-center gap-1.5">
              <MessageSquare size={12} /> Conversar
            </span>
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Header info */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-master-orange/10 text-master-orange flex items-center justify-center text-xl font-bold shrink-0">
            {contact.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
              <span className={cn("w-1.5 h-1.5 rounded-full", statusColor)} />
              <span className="text-slate-700 dark:text-slate-200 font-medium">
                {statusLabel}
              </span>
            </span>
            {contact.courseInterest && (
              <span className="ml-1.5 text-xs bg-master-orange/10 text-master-orange px-2 py-0.5 rounded font-semibold">
                {contact.courseInterest}
              </span>
            )}
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Field icon={Phone} label="Telefone" value={contact.phone} mono />
          {contact.email && (
            <Field icon={Mail} label="Email" value={contact.email} />
          )}
          {contact.source && (
            <Field
              icon={ExternalLink}
              label="Origem"
              value={contact.source}
            />
          )}
          <Field
            icon={Calendar}
            label="Cadastrado em"
            value={new Date(contact.createdAt).toLocaleDateString("pt-BR")}
          />
        </div>

        {/* Notas */}
        {contact.notes && (
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
              Notas internas
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {contact.notes}
            </p>
          </div>
        )}

        {/* Historico de conversas */}
        <div>
          <h3 className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
            Conversas ({contact.conversations.length})
          </h3>
          {contact.conversations.length === 0 ? (
            <p className="text-sm text-slate-400 italic">
              Sem conversas ainda
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {contact.conversations.map((c) => (
                <Link
                  key={c.id}
                  href={`/conversations?id=${c.id}`}
                  className="block p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-master-orange hover:bg-master-orange/5 transition group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium",
                          c.status === "open"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : c.status === "pending"
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        )}
                      >
                        {c.status}
                      </span>
                      {c.lastMessageAt && (
                        <span className="text-[10px] text-slate-500">
                          {formatDistanceToNow(new Date(c.lastMessageAt), {
                            locale: ptBR,
                            addSuffix: true,
                          })}
                        </span>
                      )}
                    </div>
                    {c.unreadCount > 0 && (
                      <span className="bg-master-orange text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                  {c.lastMessage && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 truncate">
                      {c.lastMessage}
                    </p>
                  )}
                  {c.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {c.labels.map(({ label }) => (
                        <span
                          key={label.id}
                          className="text-[10px] text-white px-1.5 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: label.color }}
                        >
                          {label.name}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center shrink-0">
        <Icon size={13} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          {label}
        </div>
        <div
          className={cn(
            "text-slate-900 dark:text-white truncate",
            mono && "font-mono"
          )}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
