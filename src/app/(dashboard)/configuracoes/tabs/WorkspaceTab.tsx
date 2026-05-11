"use client";

import { useEffect, useState } from "react";
import { Save, Wifi } from "lucide-react";
import { Button, Input, Label } from "@/components/Modal";
import { SectionCard } from "../ConfiguracoesClient";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
  evolutionInstance: string | null;
  evolutionUrl: string | null;
  evolutionKeyMasked: string | null;
  hasEvolutionKey: boolean;
}

export function WorkspaceTab() {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [name, setName] = useState("");
  const [evolutionInstance, setEvolutionInstance] = useState("");
  const [evolutionUrl, setEvolutionUrl] = useState("");
  const [evolutionKey, setEvolutionKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function load() {
    const res = await fetch("/api/workspace");
    const data = await res.json();
    setWs(data.workspace);
    setName(data.workspace.name);
    setEvolutionInstance(data.workspace.evolutionInstance ?? "");
    setEvolutionUrl(data.workspace.evolutionUrl ?? "");
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    setSaving(true);
    const body: Record<string, unknown> = {
      name: name.trim(),
      evolutionInstance: evolutionInstance.trim(),
      evolutionUrl: evolutionUrl.trim(),
    };
    if (evolutionKey.trim()) body.evolutionKey = evolutionKey.trim();
    const res = await fetch("/api/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      setSavedAt(Date.now());
      setEvolutionKey("");
      void load();
    }
  }

  if (!ws) return <p className="text-sm text-slate-500">Carregando...</p>;

  return (
    <div className="space-y-6">
      {/* Status WhatsApp */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
            <Wifi size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
              WhatsApp
            </h3>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              ● Conectado
            </p>
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-wider bg-master-orange/10 text-master-orange px-2 py-1 rounded font-medium">
          Plano {ws.plan}
        </span>
      </div>

      {/* Form */}
      <SectionCard title="Credenciais Evolution API">
        <div className="space-y-4">
          <div>
            <Label>Nome do Workspace</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>URL da Evolution API</Label>
            <Input
              value={evolutionUrl}
              onChange={(e) => setEvolutionUrl(e.target.value)}
              placeholder="https://sua-instancia.cloudfy.live"
            />
          </div>
          <div>
            <Label>Nome da Instancia</Label>
            <Input
              value={evolutionInstance}
              onChange={(e) => setEvolutionInstance(e.target.value)}
              placeholder="ex: Master Congonhas"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Label>API Key</Label>
              {ws.hasEvolutionKey && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ configurada
                </span>
              )}
            </div>
            <Input
              type="password"
              value={evolutionKey}
              onChange={(e) => setEvolutionKey(e.target.value)}
              placeholder={
                ws.evolutionKeyMasked
                  ? `${ws.evolutionKeyMasked} (deixe em branco para manter)`
                  : "cole sua API key aqui"
              }
            />
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              {saving
                ? "Salvando..."
                : savedAt
                  ? `Salvo ${new Date(savedAt).toLocaleTimeString("pt-BR")}`
                  : ""}
            </span>
            <Button onClick={save} disabled={saving}>
              <span className="flex items-center gap-2">
                <Save size={14} /> Salvar credenciais
              </span>
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* Info */}
      <SectionCard title="Workspace">
        <div className="space-y-2 text-sm">
          <Row k="ID" v={ws.id} mono />
          <Row k="Slug" v={ws.slug} mono />
          <Row k="Plano" v={ws.plan} />
        </div>
      </SectionCard>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/50 last:border-0">
      <span className="text-slate-500">{k}</span>
      <span
        className={`text-slate-900 dark:text-white ${
          mono ? "font-mono text-xs" : "font-medium"
        }`}
      >
        {v}
      </span>
    </div>
  );
}
