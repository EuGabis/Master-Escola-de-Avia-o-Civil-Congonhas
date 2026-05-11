"use client";

import { useEffect, useState } from "react";
import { UserPlus, Trash2, Users, Check } from "lucide-react";
import { Modal, Button, Input, Label } from "@/components/Modal";
import { cn } from "@/lib/cn";

interface AgentUser {
  id: string;
  name: string;
  email: string;
  role: string;
  color: string;
  isOnline: boolean;
  lastLoginAt: string | null;
}

export function AgentesTab() {
  const [users, setUsers] = useState<AgentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [delUser, setDelUser] = useState<AgentUser | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Agentes
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {users.length} {users.length === 1 ? "agente" : "agentes"} com
              acesso ao CRM
            </p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <span className="flex items-center gap-2">
              <UserPlus size={14} /> Adicionar agente
            </span>
          </Button>
        </header>

        {loading ? (
          <p className="p-5 text-sm text-slate-500">Carregando...</p>
        ) : users.length === 0 ? (
          <div className="p-10 text-center">
            <Users size={28} className="text-slate-400 mx-auto" />
            <p className="text-sm text-slate-500 mt-3">Nenhum agente</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((u) => (
              <div
                key={u.id}
                className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition group"
              >
                <div className="relative shrink-0">
                  <div
                    style={{ backgroundColor: u.color }}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  >
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  {u.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-slate-900 dark:text-white truncate">
                      {u.name}
                    </h3>
                    <span
                      className={cn(
                        "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium",
                        u.role === "owner"
                          ? "bg-master-orange/10 text-master-orange"
                          : u.role === "admin"
                            ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      )}
                    >
                      {u.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{u.email}</p>
                </div>
                <div className="hidden sm:block text-right text-xs text-slate-400 shrink-0">
                  {u.lastLoginAt
                    ? `Ultimo acesso ${new Date(u.lastLoginAt).toLocaleDateString("pt-BR")}`
                    : "Nunca acessou"}
                </div>
                {u.role !== "owner" && (
                  <button
                    onClick={() => setDelUser(u)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100"
                    title="Remover agente"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {creating && (
        <CreateAgentModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void load();
          }}
        />
      )}

      {delUser && (
        <Modal
          open
          onClose={() => setDelUser(null)}
          title="Remover agente"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDelUser(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await fetch(`/api/users/${delUser.id}`, { method: "DELETE" });
                  setDelUser(null);
                  void load();
                }}
              >
                Remover
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Remover <strong>{delUser.name}</strong> ({delUser.email})? A pessoa
            nao tera mais acesso ao CRM.
          </p>
        </Modal>
      )}
    </div>
  );
}

function CreateAgentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"agent" | "admin">("agent");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  function generatePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let p = "";
    for (let i = 0; i < 14; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
    p = p + "A1"; // garante upper + numero
    setPassword(p);
  }

  async function save() {
    setError(null);
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Preencha todos os campos");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      }),
    });
    setSaving(false);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erro");
    } else {
      setCreated({ email: email.trim(), password });
    }
  }

  if (created) {
    return (
      <Modal
        open
        onClose={() => {
          setCreated(null);
          onCreated();
        }}
        title="Agente criado"
        size="md"
        footer={
          <Button
            onClick={() => {
              setCreated(null);
              onCreated();
            }}
          >
            Concluido
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm text-emerald-700 dark:text-emerald-300 flex gap-2 items-center">
            <Check size={16} className="shrink-0" /> Conta criada com sucesso!
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <strong>Anote agora</strong> e passe pra pessoa. A senha nao sera
            mostrada de novo.
          </p>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-4 space-y-2 text-sm font-mono">
            <div>
              <span className="text-slate-500">Email: </span>
              <span className="text-slate-900 dark:text-white">
                {created.email}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Senha: </span>
              <span className="text-slate-900 dark:text-white select-all">
                {created.password}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Sugira que a pessoa altere a senha apos o primeiro login em{" "}
            <strong>Minha conta</strong>.
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Adicionar agente"
      description="Crie uma conta manualmente. A pessoa fara login com email + senha."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || !name.trim() || !email.trim() || !password.trim()}>
            {saving ? "Criando..." : "Criar agente"}
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
        <div>
          <Label>Nome completo</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex: Maria Silva"
            autoFocus
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="maria@mastercongonhas.com.br"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label>Senha temporaria</Label>
            <button
              type="button"
              onClick={generatePassword}
              className="text-xs text-master-orange hover:underline font-medium"
            >
              Gerar senha forte
            </button>
          </div>
          <Input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="minimo 12 caracteres com maiuscula, minuscula e numero"
            className="font-mono"
          />
          <p className="text-[10px] text-slate-500 mt-1">
            A pessoa pode trocar depois em <em>Minha conta</em>.
          </p>
        </div>
        <div>
          <Label>Permissao</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole("agent")}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition",
                role === "agent"
                  ? "border-master-orange bg-master-orange/5"
                  : "border-slate-200 dark:border-slate-700 hover:border-master-orange/50"
              )}
            >
              <div className="font-semibold text-slate-900 dark:text-white">
                Agente
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Atende conversas, organiza Kanban
              </div>
            </button>
            <button
              type="button"
              onClick={() => setRole("admin")}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition",
                role === "admin"
                  ? "border-master-orange bg-master-orange/5"
                  : "border-slate-200 dark:border-slate-700 hover:border-master-orange/50"
              )}
            >
              <div className="font-semibold text-slate-900 dark:text-white">
                Admin
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Tudo + adicionar/remover agentes
              </div>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
