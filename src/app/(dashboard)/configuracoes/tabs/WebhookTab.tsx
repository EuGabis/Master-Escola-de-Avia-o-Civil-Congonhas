"use client";

import { useEffect, useState } from "react";
import { Wifi, RefreshCw, Check } from "lucide-react";
import { SectionCard } from "../ConfiguracoesClient";
import { cn } from "@/lib/cn";

export function WebhookTab() {
  const [state, setState] = useState<"online" | "offline" | "checking">("checking");
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  async function check() {
    setState("checking");
    try {
      const r = await fetch("/api/health", { cache: "no-store" });
      const d = await r.json();
      setState(d.ok ? "online" : "offline");
      setCheckedAt(new Date().toLocaleTimeString("pt-BR"));
    } catch {
      setState("offline");
      setCheckedAt(new Date().toLocaleTimeString("pt-BR"));
    }
  }

  useEffect(() => {
    void check();
  }, []);

  return (
    <div className="space-y-6">
      <SectionCard
        title="Integracao WhatsApp"
        description="Status da conexao com sua instancia"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                state === "online"
                  ? "bg-emerald-500/15 text-emerald-500"
                  : state === "offline"
                    ? "bg-red-500/15 text-red-500"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-500"
              )}
            >
              <Wifi size={20} />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {state === "online" && "Tudo conectado"}
                {state === "offline" && "Conexao com problema"}
                {state === "checking" && "Verificando..."}
              </div>
              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                {state === "online" && (
                  <>
                    <Check size={12} className="text-emerald-500" />
                    Mensagens chegando normalmente
                  </>
                )}
                {state === "offline" && "Verifique as credenciais em Workspace"}
                {checkedAt && state !== "checking" && (
                  <span className="text-slate-400">· {checkedAt}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={check}
            disabled={state === "checking"}
            className="p-2 rounded-lg text-slate-500 hover:text-master-orange hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
            title="Verificar agora"
          >
            <RefreshCw size={16} className={state === "checking" ? "animate-spin" : ""} />
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Como funciona">
        <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-master-orange/10 text-master-orange text-xs font-bold flex items-center justify-center shrink-0">
              1
            </span>
            <span>
              <strong>Clientes</strong> mandam mensagens pro seu WhatsApp Business.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-master-orange/10 text-master-orange text-xs font-bold flex items-center justify-center shrink-0">
              2
            </span>
            <span>
              As mensagens aparecem instantaneamente no <strong>Inbox</strong> do CRM.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-master-orange/10 text-master-orange text-xs font-bold flex items-center justify-center shrink-0">
              3
            </span>
            <span>
              Se as <strong>automacoes</strong> ou o <strong>agente IA</strong>{" "}
              estiverem ligados, eles respondem ou classificam automaticamente.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-master-orange/10 text-master-orange text-xs font-bold flex items-center justify-center shrink-0">
              4
            </span>
            <span>
              Sua equipe atende, organiza no <strong>Kanban</strong> e acompanha
              metricas no <strong>Dashboard</strong>.
            </span>
          </li>
        </ul>
      </SectionCard>
    </div>
  );
}
