"use client";

import { Workflow, ExternalLink } from "lucide-react";
import { SectionCard } from "../ConfiguracoesClient";

export function N8nTab() {
  return (
    <div className="space-y-6">
      <SectionCard
        title="Integração n8n"
        description="Conecte fluxos low-code para automacoes avancadas (CRM, email, planilhas, calendario...)"
      >
        <div className="p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-master-orange/10 text-master-orange flex items-center justify-center mx-auto mb-3">
            <Workflow size={24} />
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white">
            n8n - automacoes externas
          </h3>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
            Receba eventos do CRM (nova conversa, nova matricula, etc) em fluxos
            n8n. Conecte com Google Sheets, Hubspot, Mailchimp, Slack, Discord e
            mais de 400 servicos.
          </p>
          <a
            href="https://n8n.io"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 mt-4 text-sm text-master-orange hover:underline font-medium"
          >
            n8n.io <ExternalLink size={12} />
          </a>
          <span className="inline-block mt-4 text-xs uppercase tracking-wider bg-master-orange/10 text-master-orange px-3 py-1 rounded-full font-medium">
            Em breve
          </span>
        </div>
      </SectionCard>
    </div>
  );
}
