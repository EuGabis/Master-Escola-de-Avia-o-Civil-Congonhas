"use client";

import { useEffect, useState } from "react";
import {
  UserPlus,
  Trash2,
  Users,
  Check,
  Shield,
  UserCog,
  User,
  Circle,
} from "lucide-react";
import { Modal, Button, Input, Label } from "@/components/Modal";
import { SkeletonList } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/cn";

interface AgentUser {
  id: string;
  name: string;
  email: string;
  role: string;
  color: string;
  isOnline: boolean;
  lastLoginAt: string | null;
  createdAt: string;
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

  const stats = {
    total: users.length,
    owner: users.filter((u) => u.role === "owner").length,
    admin: users.filter((u) => u.role === "admin").length,
    agent: users.filter((u) => u.role === "agent").length,
    online: users.filter((u) => u.isOnline).length,
  };

  return (
    <div className="space-y-6">
      {/* STATS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total" value={stats.total} icon={Users} />
        <StatCard label="Online" value={stats.online} icon={Circle} accent />
        <StatCard label="Admins" value={stats.owner + stats.admin} icon={Shield} />
        <StatCard label="Agentes" value={stats.agent} icon={User} />
      </div>

      {/* LISTA */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Equipe
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pessoas com acesso ao CRM
            </p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <span className="flex items-center gap-2">
              <UserPlus size={14} /> Adicionar agente
            </span>
          </Button>
        </header>

        {loading ? (
          <SkeletonList count={5} />
        ) : users.length === 0 ? (
          <EmptyState
            icon={<Users size={28} />}
            title="Nenhum agente cadastrado"
            description="Adicione pessoas pro time atender conversas e usar o CRM."
            action={
              <Button onClick={() => setCreating(true)}>
                <span className="flex items-center gap-2">
                  <UserPlus size={14} /> Adicionar primeiro agente
                </span>
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((u) => (
              <AgentRow
                key={u.id}
                user={u}
                onDelete={() => setDelUser(u)}
              />
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
            nao tera mais acesso ao CRM. Conversas atribuidas a ela serao
            mantidas, mas sem responsavel.
          </p>
        </Modal>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-start justify-between">
      <div>
        <div className="text-2xl font-bold text-slate-900 dark:text-white leading-none">
          {value}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1.5 font-semibold">
          {label}
        </div>
      </div>
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
          accent
            ? "bg-emerald-500/15 text-emerald-500"
            : "bg-master-orange/10 text-master-orange"
        )}
      >
        <Icon size={14} className={accent ? "fill-current" : ""} />
      </div>
    </div>
  );
}

function AgentRow({
  user,
  onDelete,
}: {
  user: AgentUser;
  onDelete: () => void;
}) {
  const RoleIcon = user.role === "owner" ? Shield : user.role === "admin" ? UserCog : User;
  const roleClass =
    user.role === "owner"
      ? "bg-master-orange/10 text-master-orange"
      : user.role === "admin"
        ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300";

  return (
    <div className="px-5 py-3 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition group">
      <div className="relative shrink-0">
        <div
          style={{ backgroundColor: user.color }}
          className="w-11 h-11 rounded-full flex items-center justify-center text-white text-base font-bold shadow-sm"
        >
          {user.name.charAt(0).toUpperCase()}
        </div>
        {user.isOnline && (
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-900 dark:text-white truncate">
            {user.name}
          </h3>
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium",
              roleClass
            )}
          >
            <RoleIcon size={10} /> {user.role}
          </span>
          {user.isOnline && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              ● online
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>
      </div>

      <div className="hidden md:flex flex-col items-end text-xs text-slate-400 shrink-0">
        <span>
          {user.lastLoginAt
            ? `Ultimo acesso ${new Date(user.lastLoginAt).toLocaleDateString("pt-BR")}`
            : "Nunca acessou"}
        </span>
        <span className="text-[10px]">
          Entrou em {new Date(user.createdAt).toLocaleDateString("pt-BR")}
        </span>
      </div>

      {user.role !== "owner" && (
        <button
          onClick={onDelete}
          className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100"
          title="Remover agente"
        >
          <Trash2 size={14} />
        </button>
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
  const [copied, setCopied] = useState(false);

  function generatePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let p = "";
    for (let i = 0; i < 14; i++)
      p += chars.charAt(Math.floor(Math.random() * chars.length));
    p = p + "A1";
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
    if (!res.ok) setError(data.error ?? "Erro");
    else setCreated({ email: email.trim(), password });
  }

  if (created) {
    return (
      <Modal
        open
        onClose={() => {
          setCreated(null);
          onCreated();
        }}
        title="✓ Agente criado"
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
        <div className="space-y-4">
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm text-emerald-700 dark:text-emerald-300 flex gap-2 items-start">
            <Check size={16} className="shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Conta criada com sucesso!</div>
              <div className="text-xs mt-1 opacity-80">
                Anote agora — a senha nao sera mostrada de novo.
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                Credenciais
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Email: ${created.email}\nSenha: ${created.password}`
                  );
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded transition",
                  copied
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-master-orange text-white"
                )}
              >
                {copied ? "✓ Copiado" : "Copiar tudo"}
              </button>
            </div>
            <div className="p-4 space-y-2 text-sm font-mono">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs w-16">Email</span>
                <span className="text-slate-900 dark:text-white select-all">
                  {created.email}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs w-16">Senha</span>
                <span className="text-slate-900 dark:text-white select-all">
                  {created.password}
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Recomende que a pessoa altere a senha apos o primeiro login em{" "}
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
          <Button
            onClick={save}
            disabled={saving || !name.trim() || !email.trim() || !password.trim()}
          >
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
            placeholder="mínimo 6 caracteres (qualquer combinação)"
            className="font-mono"
          />
          <p className="text-[10px] text-slate-500 mt-1">
            Você define a senha inicial. A pessoa pode trocar depois em <em>Minha conta</em>.
          </p>
        </div>
        <div>
          <Label>Permissao</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole("agent")}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition flex items-start gap-2",
                role === "agent"
                  ? "border-master-orange bg-master-orange/5"
                  : "border-slate-200 dark:border-slate-700 hover:border-master-orange/50"
              )}
            >
              <User size={16} className="text-master-orange mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">
                  Agente
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Atende conversas e organiza Kanban
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setRole("admin")}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition flex items-start gap-2",
                role === "admin"
                  ? "border-master-orange bg-master-orange/5"
                  : "border-slate-200 dark:border-slate-700 hover:border-master-orange/50"
              )}
            >
              <UserCog size={16} className="text-master-orange mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">
                  Admin
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Tudo + gerenciar agentes
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
