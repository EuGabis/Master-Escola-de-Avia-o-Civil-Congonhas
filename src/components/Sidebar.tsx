"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessagesSquare,
  Columns3,
  BarChart3,
  Users,
  Tag,
  Settings,
  ChevronLeft,
  Wifi,
  WifiOff,
  Search,
  LogOut,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getPusherClient } from "@/lib/pusher-client";
import { cn } from "@/lib/cn";

interface SidebarProps {
  workspaceId: string;
  user: { name: string; email: string; role: string; avatar: string | null };
}

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/conversations", label: "Conversas", icon: MessagesSquare },
  { href: "/pipeline", label: "Pipeline", icon: Columns3 },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/contatos", label: "Contatos", icon: Users },
  { href: "/etiquetas", label: "Etiquetas", icon: Tag },
  { href: "/configuracoes", label: "Configuracoes", icon: Settings },
];

export function Sidebar({ workspaceId, user }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [wppState, setWppState] = useState<"open" | "close" | "connecting">("open");

  // Inscreve no canal do workspace para atualizar status do WhatsApp
  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`private-workspace-${workspaceId}`);
    channel.bind("connection:update", ({ state }: { state: string }) => {
      if (state === "open") setWppState("open");
      else if (state === "connecting") setWppState("connecting");
      else setWppState("close");
    });
    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`private-workspace-${workspaceId}`);
    };
  }, [workspaceId]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside
      className={cn(
        "h-screen flex flex-col bg-master-navy text-slate-100 transition-all duration-200 shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* HEADER - Logo */}
      <div className="p-4 flex items-center justify-between border-b border-white/5">
        {!collapsed && <Logo variant="white" size="md" />}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="p-1.5 rounded-lg hover:bg-white/10 transition"
          title={collapsed ? "Expandir" : "Recolher"}
        >
          <ChevronLeft
            size={18}
            className={cn("transition", collapsed && "rotate-180")}
          />
        </button>
      </div>

      {/* STATUS WhatsApp */}
      <div className="px-3 py-3 border-b border-white/5">
        <div
          className={cn(
            "flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg",
            wppState === "open"
              ? "bg-emerald-500/15 text-emerald-300"
              : wppState === "connecting"
                ? "bg-amber-500/15 text-amber-300"
                : "bg-red-500/15 text-red-300"
          )}
        >
          {wppState === "open" ? <Wifi size={14} /> : <WifiOff size={14} />}
          {!collapsed && (
            <span>
              {wppState === "open"
                ? "WhatsApp conectado"
                : wppState === "connecting"
                  ? "Conectando..."
                  : "Desconectado"}
            </span>
          )}
        </div>
      </div>

      {/* SEARCH (cosmetico, ainda nao funcional) */}
      {!collapsed && (
        <div className="px-3 py-3">
          <div className="flex items-center gap-2 bg-white/5 rounded-lg px-2.5 py-1.5 text-xs text-slate-400">
            <Search size={14} />
            <input
              type="text"
              placeholder="Buscar..."
              className="flex-1 bg-transparent outline-none placeholder:text-slate-500 text-slate-200"
            />
            <kbd className="text-[10px] bg-white/10 px-1 rounded">⌘K</kbd>
          </div>
        </div>
      )}

      {/* NAV */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition",
                active
                  ? "bg-master-orange text-white shadow-md shadow-master-orange/30"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* FOOTER - User + Theme + Logout */}
      <div className="p-3 border-t border-white/5 space-y-1">
        {!collapsed && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5">
            <div className="w-8 h-8 rounded-full bg-master-orange flex items-center justify-center text-white text-sm font-bold shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {user.name}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                {user.role}
              </div>
            </div>
          </div>
        )}
        <ThemeToggle collapsed={collapsed} />
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-300 hover:bg-red-500/10 transition"
          >
            <LogOut size={18} />
            {!collapsed && <span>Sair</span>}
          </button>
        </form>
      </div>
    </aside>
  );
}
