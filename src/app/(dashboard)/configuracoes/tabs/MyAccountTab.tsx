"use client";

import { useEffect, useState } from "react";
import { Save, KeyRound, Check } from "lucide-react";
import { Button, Input, Label } from "@/components/Modal";
import { SectionCard } from "../ConfiguracoesClient";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  color: string;
}

export function MyAccountTab() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#F26522");
  const [saving, setSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSaved, setPwdSaved] = useState(false);

  async function load() {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    setUser(data.user);
    setName(data.user.name);
    setColor(data.user.color);
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
      body: JSON.stringify({ name: name.trim(), color }),
    });
    setSaving(false);
    if (res.ok) {
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
      void load();
    }
  }

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
      setTimeout(() => setPwdSaved(false), 3000);
    } else {
      setPwdError(data.error ?? "Erro");
    }
  }

  if (!user) return <p className="text-sm text-slate-500">Carregando...</p>;

  const COLORS = [
    "#F26522", "#3b82f6", "#10b981", "#f59e0b",
    "#ef4444", "#ec4899", "#8b5cf6", "#06b6d4",
  ];

  return (
    <div className="space-y-6">
      <SectionCard title="Perfil" description="Informacoes do seu usuario">
        <div className="space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div
              style={{ backgroundColor: color }}
              className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold shrink-0 shadow-md"
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-900 dark:text-white">
                {user.email}
              </div>
              <span className="text-[10px] uppercase tracking-wider bg-master-orange/10 text-master-orange px-2 py-0.5 rounded font-medium">
                {user.role}
              </span>
            </div>
          </div>

          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <Label>Cor do avatar</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-8 h-8 rounded-full transition border-2 ${
                    color === c
                      ? "border-slate-900 dark:border-white scale-110"
                      : "border-transparent"
                  }`}
                />
              ))}
            </div>
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
