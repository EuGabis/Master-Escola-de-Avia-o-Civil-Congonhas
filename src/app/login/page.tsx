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
      className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5 border border-slate-100 dark:border-slate-700"
    >
      <div className="text-center space-y-3">
        <Logo size="lg" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Sistema de atendimento
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm p-3 border border-red-100 dark:border-red-800">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Email
        </label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-master-orange focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Senha
        </label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-master-orange focus:border-transparent"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-pill bg-master-orange hover:bg-master-orange-600 disabled:opacity-60 text-white font-semibold py-3 transition shadow-md hover:shadow-lg"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>

      <div className="text-center text-sm">
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
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-master-orange via-master-orange-600 to-master-orange-700 p-4 relative overflow-hidden">
      <PlaneIcon className="absolute -top-20 -right-20 w-96 h-96 text-white/5 rotate-[20deg]" />
      <PlaneIcon className="absolute -bottom-32 -left-32 w-[28rem] h-[28rem] text-white/5 -rotate-[15deg]" />
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
