"use client";

import { useEffect, useState } from "react";
import { UserPlus, Users } from "lucide-react";
import { Button } from "@/components/Modal";
import { SectionCard } from "../ConfiguracoesClient";

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
              Agentes (equipe do workspace)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {users.length} {users.length === 1 ? "usuario" : "usuarios"} com
              acesso ao CRM
            </p>
          </div>
          <Button disabled>
            <span className="flex items-center gap-2">
              <UserPlus size={14} /> Convidar (em breve)
            </span>
          </Button>
        </header>

        {loading ? (
          <p className="p-5 text-sm text-slate-500">Carregando...</p>
        ) : users.length === 0 ? (
          <div className="p-10 text-center">
            <Users size={28} className="text-slate-400 mx-auto" />
            <p className="text-sm text-slate-500 mt-3">Nenhum usuario</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((u) => (
              <div
                key={u.id}
                className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition"
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
                    <span className="text-[10px] uppercase tracking-wider bg-master-orange/10 text-master-orange px-1.5 py-0.5 rounded font-medium">
                      {u.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{u.email}</p>
                </div>
                <div className="text-right text-xs text-slate-400 shrink-0">
                  {u.lastLoginAt
                    ? `Ult. acesso: ${new Date(u.lastLoginAt).toLocaleDateString("pt-BR")}`
                    : "Nunca acessou"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SectionCard title="Como adicionar mais agentes">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Para enviar convites por email, precisamos primeiro configurar um
          servico SMTP (Resend, SendGrid, etc). Isso vem na proxima etapa do
          projeto.
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
          Enquanto isso, voce pode criar agentes manualmente no banco de dados
          (Railway &rarr; Postgres &rarr; Data &rarr; tabela <code>User</code>).
        </p>
      </SectionCard>
    </div>
  );
}
