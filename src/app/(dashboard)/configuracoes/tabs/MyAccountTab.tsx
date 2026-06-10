"use client";

import { useEffect, useRef, useState } from "react";
import { Save, KeyRound, Check, Camera, Trash2 } from "lucide-react";
import { Button, Input, Label } from "@/components/Modal";
import { UserAvatar } from "@/components/UserAvatar";
import { compressImage } from "@/lib/compress";
import { SectionCard } from "../ConfiguracoesClient";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  color: string;
  avatar: string | null;
}

export function MyAccountTab() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSaved, setPwdSaved] = useState(false);

  async function load() {
    const res = await fetch("/api/me");
    const data = await res.json();
    setUser(data.user);
    setName(data.user.name);
  }

  /**
   * Le o arquivo, comprime para 256x256 jpeg quality 0.7 e converte para
   * data URL. Salva no servidor via PATCH /api/me. O servidor re-emite o
   * cookie de sessao com o novo avatar, entao a Sidebar reflete logo na
   * proxima navegacao (e o reload aqui ja mostra a foto nova).
   */
  async function handleAvatarFile(file: File) {
    setAvatarError(null);
    if (!file.type.startsWith("image/")) {
      setAvatarError("Selecione uma imagem (jpeg, png, webp).");
      return;
    }
    setUploadingAvatar(true);
    try {
      // Quadrado pequeno + quality baixa pra caber confortavel no JWT
      // e no DB sem inflar.
      const compressed = await compressImage(file, { maxWidth: 256, quality: 0.7 });
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
        reader.readAsDataURL(compressed);
      });
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAvatarError(
          (Array.isArray(data?.details) && data.details.join("; ")) ||
            data?.error ||
            "Erro ao salvar foto"
        );
        return;
      }
      await load();
      // Reload completo do dashboard pra Sidebar pegar o novo JWT
      setTimeout(() => window.location.reload(), 300);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeAvatar() {
    setUploadingAvatar(true);
    setAvatarError(null);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: null }),
      });
      if (res.ok) {
        await load();
        setTimeout(() => window.location.reload(), 300);
      }
    } finally {
      setUploadingAvatar(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveProfile() {
    setSaving(true);
    setProfileSaved(false);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setSaving(false);
    if (res.ok) {
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
      void load();
    }
  }

  // Cor do avatar continua existindo no schema mas, com fotos+gradient
  // por hash do nome, virou opcional. Mantemos o campo no banco mas a
  // UI nao mostra mais o seletor de cor — evita confusao.

  async function savePassword() {
    setPwdError(null);
    setPwdSaved(false);
    if (next !== confirm) {
      setPwdError("Senhas nao conferem");
      return;
    }
    setPwdSaving(true);
    const res = await fetch("/api/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current, next }),
    });
    setPwdSaving(false);
    const data = await res.json();
    if (res.ok) {
      setPwdSaved(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      // Senha trocada -> servidor destruiu sessao, redireciona pro login
      if (data.reauth) {
        setTimeout(() => {
          window.location.href = "/login?next=/configuracoes?tab=conta";
        }, 1500);
      } else {
        setTimeout(() => setPwdSaved(false), 3000);
      }
    } else {
      setPwdError(data.error ?? "Erro");
    }
  }

  if (!user) return <p className="text-sm text-slate-500">Carregando...</p>;

  return (
    <div className="space-y-6">
      <SectionCard title="Perfil" description="Informacoes do seu usuario">
        <div className="space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <UserAvatar
                name={user.name}
                avatar={user.avatar}
                size={72}
                ring
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                title="Trocar foto"
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-master-orange hover:bg-master-orange-600 text-white shadow-md flex items-center justify-center transition active:scale-95 disabled:opacity-60"
              >
                <Camera size={13} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleAvatarFile(f);
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-900 dark:text-white">
                {user.email}
              </div>
              <span className="text-[10px] uppercase tracking-wider bg-master-orange/10 text-master-orange px-2 py-0.5 rounded font-medium">
                {user.role}
              </span>
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="text-xs text-master-orange hover:underline font-medium disabled:opacity-60"
                >
                  {uploadingAvatar
                    ? "Enviando..."
                    : user.avatar
                      ? "Trocar foto"
                      : "Adicionar foto"}
                </button>
                {user.avatar && !uploadingAvatar && (
                  <button
                    type="button"
                    onClick={removeAvatar}
                    className="text-xs text-slate-500 hover:text-red-500 flex items-center gap-1 font-medium"
                  >
                    <Trash2 size={11} /> Remover
                  </button>
                )}
              </div>
              {avatarError && (
                <p className="text-xs text-red-500 mt-1">{avatarError}</p>
              )}
            </div>
          </div>

          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              {profileSaved && (
                <>
                  <Check size={12} /> Perfil atualizado
                </>
              )}
            </span>
            <Button onClick={saveProfile} disabled={saving}>
              <span className="flex items-center gap-2">
                <Save size={14} /> {saving ? "Salvando..." : "Salvar perfil"}
              </span>
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Alterar senha"
        description="Use uma senha forte: minimo 12 caracteres com letra maiuscula, minuscula e numero"
      >
        <div className="space-y-4">
          {pwdError && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm p-3">
              {pwdError}
            </div>
          )}
          <div>
            <Label>Senha atual</Label>
            <Input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div>
            <Label>Nova senha</Label>
            <Input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label>Confirmar nova senha</Label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              {pwdSaved && (
                <>
                  <Check size={12} /> Senha alterada
                </>
              )}
            </span>
            <Button
              onClick={savePassword}
              disabled={pwdSaving || !current || !next || !confirm}
            >
              <span className="flex items-center gap-2">
                <KeyRound size={14} />{" "}
                {pwdSaving ? "Alterando..." : "Alterar senha"}
              </span>
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
