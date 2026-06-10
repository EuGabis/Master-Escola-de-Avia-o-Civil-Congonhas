"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo, PlaneIcon } from "@/components/Logo";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Erro ao entrar");
      else {
        router.replace(next);
        router.refresh();
      }
    } catch {
      setError("Erro de rede");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative w-full max-w-sm bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/20 p-7 sm:p-9 space-y-5 border border-white/40 dark:border-white/5 animate-fade-in"
    >
      {/* Brilho decorativo no topo */}
      <div
        aria-hidden="true"
        className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/30 to-transparent"
      />

      <div className="text-center space-y-3">
        <div className="inline-flex">
          <Logo size="lg" />
        </div>
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 font-semibold">
          Sistema de atendimento
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm p-3 border border-red-100 dark:border-red-800 animate-fade-in">
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
          Email
        </label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-master-orange focus:bg-white dark:focus:bg-slate-800 focus:border-transparent transition"
          placeholder="voce@mastercongonhas.com.br"
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
          Senha
        </label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-master-orange focus:bg-white dark:focus:bg-slate-800 focus:border-transparent transition"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-pill bg-master-orange hover:bg-master-orange-600 disabled:opacity-60 text-white font-semibold py-3 transition-all duration-200 shadow-lg shadow-master-orange/30 hover:shadow-xl hover:shadow-master-orange/40 active:scale-[0.98]"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>

      <div className="text-center text-sm pt-1">
        <Link
          href="/forgot-password"
          className="text-master-navy dark:text-master-orange hover:underline font-medium"
        >
          Esqueci minha senha
        </Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-master-orange-600 via-master-orange to-master-orange-700 p-4 relative overflow-hidden">
      {/* Aviao decorativo grande no topo direito */}
      <PlaneIcon className="absolute -top-20 -right-20 w-96 h-96 text-white/5 rotate-[20deg]" />
      {/* Outro embaixo esquerda */}
      <PlaneIcon className="absolute -bottom-32 -left-32 w-[28rem] h-[28rem] text-white/5 -rotate-[15deg]" />
      {/* Vinheta sutil pra dar profundidade */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/30 pointer-events-none"
      />
      {/* Glow atras do card */}
      <div
        aria-hidden="true"
        className="absolute w-[420px] h-[420px] rounded-full bg-white/10 blur-3xl pointer-events-none"
      />
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
