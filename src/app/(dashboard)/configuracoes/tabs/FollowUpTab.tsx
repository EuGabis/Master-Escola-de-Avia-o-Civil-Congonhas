"use client";

import { Bell, Clock } from "lucide-react";
import { SectionCard } from "../ConfiguracoesClient";

export function FollowUpTab() {
  return (
    <div className="space-y-6">
      <SectionCard
        title="Follow-up automatico"
        description="Reengaja contatos que ficaram sem responder por um tempo"
      >
        <div className="p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-master-orange/10 text-master-orange flex items-center justify-center mx-auto mb-3">
            <Bell size={24} />
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Em construcao
          </h3>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
            Configure mensagens automaticas que sao enviadas apos X horas sem
            resposta. Util pra recuperar leads frios sem trabalho manual.
          </p>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto text-left">
            <Feature icon={Clock} title="Gatilho por inatividade" desc="Ex: 24h sem resposta" />
            <Feature icon={Bell} title="Mensagem customizada" desc="Texto personalizado" />
            <Feature icon={Clock} title="Limite de tentativas" desc="Max 3x por contato" />
          </div>
          <span className="inline-block mt-6 text-xs uppercase tracking-wider bg-master-orange/10 text-master-orange px-3 py-1 rounded-full font-medium">
            Em breve
          </span>
        </div>
      </SectionCard>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
      <Icon size={16} className="text-master-orange mb-2" />
      <div className="text-sm font-medium text-slate-900 dark:text-white">
        {title}
      </div>
      <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
    </div>
  );
}
