"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Webhook as WebhookIcon, ExternalLink } from "lucide-react";
import { SectionCard } from "../ConfiguracoesClient";
import { cn } from "@/lib/cn";

export function WebhookTab() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [evolutionUrl, setEvolutionUrl] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/webhook`);
    void fetch("/api/workspace")
      .then((r) => r.json())
      .then((d) => setEvolutionUrl(d.workspace?.evolutionUrl ?? ""));
  }, []);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Webhook URL"
        description="URL que voce deve configurar na sua Evolution API. Todas as mensagens chegam aqui."
      >
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                Endpoint
              </span>
              <span className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-medium">
                POST
              </span>
            </div>
            <CopyField value={webhookUrl} onCopy={() => copy(webhookUrl, "url")} copied={copied === "url"} />
          </div>

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 text-xs space-y-2">
            <div className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <WebhookIcon size={14} /> Autenticacao via header `apikey`
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              A Evolution precisa enviar o header <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">apikey</code>{" "}
              com o mesmo valor da sua API Key (configurada em <strong>Workspace</strong>).
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              No painel Evolution &rarr; Webhook &rarr; adicione <strong>Custom Header</strong>:{" "}
              <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">apikey: SUA_KEY</code>
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Eventos recomendados"
        description="Marque esses eventos no painel da sua Evolution API"
      >
        <ul className="space-y-2 text-sm">
          <EventRow code="MESSAGES_UPSERT" label="Mensagem recebida ou enviada" required />
          <EventRow code="MESSAGES_UPDATE" label="Status (entregue, lido)" required />
          <EventRow code="CONNECTION_UPDATE" label="Status do WhatsApp" required />
        </ul>
        <p className="text-[10px] text-slate-500 mt-3">
          Marque <strong>Webhook by Events</strong> = OFF e <strong>Webhook Base64</strong> = ON
          (recomendado para receber midias).
        </p>
      </SectionCard>

      {evolutionUrl && (
        <SectionCard title="Sua instancia Evolution">
          <a
            href={evolutionUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-master-orange hover:underline font-medium"
          >
            {evolutionUrl} <ExternalLink size={12} />
          </a>
        </SectionCard>
      )}
    </div>
  );
}

function CopyField({
  value,
  onCopy,
  copied,
}: {
  value: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="flex items-stretch rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <input
        readOnly
        value={value}
        className="flex-1 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white font-mono outline-none"
        onFocus={(e) => e.target.select()}
      />
      <button
        onClick={onCopy}
        className={cn(
          "px-3 text-xs font-medium transition flex items-center gap-1.5",
          copied
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            : "bg-master-orange hover:bg-master-orange-600 text-white"
        )}
      >
        {copied ? (
          <>
            <Check size={14} /> Copiado
          </>
        ) : (
          <>
            <Copy size={14} /> Copiar
          </>
        )}
      </button>
    </div>
  );
}

function EventRow({ code, label, required }: { code: string; label: string; required?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
      <code className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded font-mono text-slate-900 dark:text-white">
        {code}
      </code>
      <span className="text-sm text-slate-600 dark:text-slate-300 flex-1">{label}</span>
      {required && (
        <span className="text-[10px] uppercase tracking-wider bg-master-orange/10 text-master-orange px-1.5 py-0.5 rounded font-medium">
          Obrigatorio
        </span>
      )}
    </li>
  );
}
