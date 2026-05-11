"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  Bell,
  Webhook,
  Bot,
  Zap,
  MessagesSquare,
  Users,
  UserCircle2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { AgentConfigForm } from "@/components/AgentConfigForm";
import { WorkspaceTab } from "./tabs/WorkspaceTab";
import { FollowUpTab } from "./tabs/FollowUpTab";
import { WebhookTab } from "./tabs/WebhookTab";
import { AutomacoesTab } from "./tabs/AutomacoesTab";
import { QuickRepliesTab } from "./tabs/QuickRepliesTab";
import { AgentesTab } from "./tabs/AgentesTab";
import { MyAccountTab } from "./tabs/MyAccountTab";

const TABS = [
  { key: "workspace", label: "Workspace", icon: Settings },
  { key: "followup", label: "Follow-up", icon: Bell },
  { key: "webhook", label: "Webhook", icon: Webhook },
  { key: "ia", label: "Agente IA", icon: Bot },
  { key: "automacoes", label: "Automações", icon: Zap },
  { key: "respostas", label: "Respostas Rápidas", icon: MessagesSquare },
  { key: "agentes", label: "Agentes", icon: Users },
  { key: "conta", label: "Minha conta", icon: UserCircle2 },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function ConfiguracoesClient() {
  const [tab, setTab] = useState<TabKey>("workspace");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    if (t && TABS.some((x) => x.key === t)) setTab(t as TabKey);
  }, []);

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
            Configurações
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie integrações, agentes e preferências do workspace
          </p>
        </div>
      </header>

      {/* TABS (pegada Estacione Park - pill bar) */}
      <div className="px-6 lg:px-8 pt-5">
        <nav className="inline-flex flex-wrap gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-all",
                  active
                    ? "bg-master-orange text-white shadow-md shadow-master-orange/30"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                )}
              >
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* CONTENT */}
      <div className="px-6 lg:px-8 pb-8 pt-6 max-w-4xl mx-auto">
        {tab === "workspace" && <WorkspaceTab />}
        {tab === "followup" && <FollowUpTab />}
        {tab === "webhook" && <WebhookTab />}
        {tab === "ia" && (
          <SectionCard title="Agente IA (OpenAI ou Anthropic)">
            <AgentConfigForm />
          </SectionCard>
        )}
        {tab === "automacoes" && <AutomacoesTab />}
        {tab === "respostas" && <QuickRepliesTab />}
        {tab === "agentes" && <AgentesTab />}
        {tab === "conta" && <MyAccountTab />}
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
