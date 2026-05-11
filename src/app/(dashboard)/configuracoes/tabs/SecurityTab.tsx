"use client";

import { ShieldCheck, Lock, KeyRound, Activity, FileCheck } from "lucide-react";
import { SectionCard } from "../ConfiguracoesClient";

export function SecurityTab() {
  return (
    <div className="space-y-6">
      <SectionCard
        title="Praticas de seguranca aplicadas"
        description="O sistema implementa OWASP Top 10 + boas praticas modernas"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Item
            icon={Lock}
            title="Senhas com bcrypt"
            desc="Hash de 12 rounds (recomendacao OWASP 2026)"
          />
          <Item
            icon={KeyRound}
            title="JWT em cookie httpOnly"
            desc="HS256 + SameSite=Lax + Secure (prod)"
          />
          <Item
            icon={ShieldCheck}
            title="Rate limit por IP+email"
            desc="5 tentativas / 15min via Upstash Redis"
          />
          <Item
            icon={Activity}
            title="Audit log completo"
            desc="Login, logout, reset, mudanca de senha, acoes sensiveis"
          />
          <Item
            icon={FileCheck}
            title="Validacao Zod"
            desc="Todo input do client eh validado no servidor"
          />
          <Item
            icon={ShieldCheck}
            title="Cabecalhos de seguranca"
            desc="HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy"
          />
        </div>
      </SectionCard>

      <SectionCard title="Recomendacoes">
        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <li className="flex gap-2">
            <span className="text-master-orange">●</span>
            <span>
              <strong>Rotacione</strong> a API key da Evolution e as chaves OpenAI/Anthropic
              periodicamente (a cada 90 dias).
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-master-orange">●</span>
            <span>
              <strong>Nunca compartilhe</strong> senhas, tokens ou JWT_SECRET por
              chat/email.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-master-orange">●</span>
            <span>
              Crie usuarios <strong>agent</strong> para a equipe em vez de
              compartilhar a conta <em>owner</em>.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-master-orange">●</span>
            <span>
              Backups do Postgres acontecem diariamente no Railway. Considere um
              backup externo para retencao maior.
            </span>
          </li>
        </ul>
      </SectionCard>
    </div>
  );
}

function Item({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
      <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
        <Icon size={16} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          {title}
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
