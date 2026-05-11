"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  Webhook,
  Bot,
  MessagesSquare,
  UserCircle2,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { AgentConfigForm } from "@/components/AgentConfigForm";
import { WorkspaceTab } from "./tabs/WorkspaceTab";
import { WebhookTab } from "./tabs/WebhookTab";
import { QuickRepliesTab } from "./tabs/QuickRepliesTab";
import { MyAccountTab } from "./tabs/MyAccountTab";
import { SecurityTab } from "./tabs/SecurityTab";

const TABS = [
  { key: "workspace", label: "Workspace", icon: Settings },
  { key: "webhook", label: "Webhook", icon: Webhook },
  { key: "ia", label: "Agente IA", icon: Bot },
  { key: "respostas", label: "Respostas Rapidas", icon: MessagesSquare },
  { key: "conta", label: "Minha conta", icon: UserCircle2 },
  { key: "seguranca", label: "Seguranca", icon: ShieldCheck },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function ConfiguracoesClient() {
  const [tab, setTab] = useState<TabKey>("workspace");

  // Le ?tab= da URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    if (t && TABS.some((x) => x.key === t)) setTab(t as TabKey);
  }, []);

  // Persiste tab na URL
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url.toString());
  }, [tab]);

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      {/* HEADER */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="px-6 lg:px-8 py-5">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Configuracoes
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie workspace, integracoes, agente IA e sua conta
          </p>
        </div>

        {/* TABS */}
        <nav className="px-4 lg:px-6 flex flex-wrap gap-1 -mb-px">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition",
                  active
                    ? "border-master-orange text-master-orange"
                    : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* CONTENT */}
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        {tab === "workspace" && <WorkspaceTab />}
        {tab === "webhook" && <WebhookTab />}
        {tab === "ia" && (
          <SectionCard title="Agente IA (OpenAI ou Claude)">
            <AgentConfigForm />
          </SectionCard>
        )}
        {tab === "respostas" && <QuickRepliesTab />}
        {tab === "conta" && <MyAccountTab />}
        {tab === "seguranca" && <SecurityTab />}
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <header className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2>
        {description && (
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        )}
      </header>
      <div className="p-5">{children}</div>
    </div>
  );
}
