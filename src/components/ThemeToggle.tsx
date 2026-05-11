"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = theme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-300 hover:bg-white/5 transition"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
      {!collapsed && <span>Modo {isDark ? "claro" : "escuro"}</span>}
    </button>
  );
}
