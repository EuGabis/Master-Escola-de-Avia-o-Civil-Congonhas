"use client";

import { useEffect, useRef, useState } from "react";
import { Save, Wifi, Image as ImageIcon, Trash2 } from "lucide-react";
import { Button, Input, Label } from "@/components/Modal";
import { compressImage } from "@/lib/compress";
import { SectionCard } from "../ConfiguracoesClient";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
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

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  /**
   * Comprime a logo client-side e salva como data URL. Limite generoso
   * (max 480px de largura, jpeg quality 0.85) pra logos ficarem nitidas
   * sem inflar o banco. SVGs sao enviados sem compressao porque ja sao
   * vetoriais e leves.
   */
  async function handleLogoFile(file: File) {
    setLogoError(null);
    if (!file.type.startsWith("image/")) {
      setLogoError("Selecione uma imagem (png, jpeg, webp ou svg).");
      return;
    }
    setUploadingLogo(true);
    try {
      const isSvg = file.type === "image/svg+xml";
      const finalFile = isSvg
        ? file
        : await compressImage(file, { maxWidth: 480, quality: 0.85 });
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
        reader.readAsDataURL(finalFile);
      });
      const res = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLogoError(
          (Array.isArray(data?.details) && data.details.join("; ")) ||
            data?.error ||
            "Erro ao salvar logo"
        );
        return;
      }
      await load();
      // Reload pra Sidebar pegar a nova logo
      setTimeout(() => window.location.reload(), 300);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeLogo() {
    setUploadingLogo(true);
    setLogoError(null);
    try {
      const res = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo: null }),
      });
      if (res.ok) {
        await load();
        setTimeout(() => window.location.reload(), 300);
      }
    } finally {
      setUploadingLogo(false);
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
      </div>

      {/* Logo personalizada */}
      <SectionCard
        title="Logo da empresa"
        description="Aparece no topo do menu lateral. Sem logo, mostramos o nome do workspace."
      >
        <div className="flex items-center gap-5">
          {/* Preview */}
          <div className="w-32 h-20 rounded-xl bg-master-navy flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-slate-200 dark:ring-slate-700">
            {ws.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ws.logo}
                alt="Logo"
                className="max-w-full max-h-full object-contain p-2"
                draggable={false}
              />
            ) : (
              <span className="text-white text-base font-black tracking-[0.18em]">
                {(ws.name || "MASTER").slice(0, 7).toUpperCase()}
              </span>
            )}
          </div>

          {/* Acoes */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
              >
                <span className="flex items-center gap-2">
                  <ImageIcon size={14} />
                  {uploadingLogo
                    ? "Enviando..."
                    : ws.logo
                      ? "Trocar logo"
                      : "Adicionar logo"}
                </span>
              </Button>
              {ws.logo && !uploadingLogo && (
                <button
                  type="button"
                  onClick={removeLogo}
                  className="text-xs text-slate-500 hover:text-red-500 flex items-center gap-1 font-medium transition"
                >
                  <Trash2 size={11} /> Remover
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleLogoFile(f);
                }}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              PNG, JPG, WEBP ou SVG · Recomendado: fundo transparente, formato
              horizontal (ex: 480x180px).
            </p>
            {logoError && (
              <p className="text-xs text-red-500 mt-1.5">{logoError}</p>
            )}
          </div>
        </div>
      </SectionCard>

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
    </div>
  );
}
