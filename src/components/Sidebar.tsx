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
        "h-screen flex flex-col gradient-master-navy text-slate-100 transition-[width] duration-200 ease-out shrink-0 relative",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      {/* LOGO */}
      <div className="px-4 pt-5 pb-4 flex items-center justify-between">
        {!collapsed ? (
          <Logo variant="white" size="md" />
        ) : (
          <div className="w-full flex justify-center">
            <div className="w-9 h-9 rounded-xl bg-master-orange flex items-center justify-center text-white font-extrabold text-lg shadow-lg shadow-master-orange/30">
              M
            </div>
          </div>
        )}
      </div>

      {/* COLLAPSE BUTTON (floating) */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-7 w-6 h-6 rounded-full bg-white text-master-navy hover:bg-master-orange hover:text-white shadow-lg flex items-center justify-center transition z-10"
        title={collapsed ? "Expandir" : "Recolher"}
      >
        <ChevronLeft size={14} className={cn("transition", collapsed && "rotate-180")} />
      </button>

      {/* STATUS WhatsApp */}
      <div className="px-3 mb-1">
        <div
          className={cn(
            "flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition",
            wppState === "open"
              ? "bg-emerald-500/15 text-emerald-300"
              : wppState === "connecting"
                ? "bg-amber-500/15 text-amber-300"
                : "bg-red-500/15 text-red-300",
            collapsed && "justify-center"
          )}
        >
          {wppState === "open" ? (
            <Wifi size={14} className="shrink-0" />
          ) : (
            <WifiOff size={14} className="shrink-0" />
          )}
          {!collapsed && (
            <span className="font-medium">
              {wppState === "open"
                ? "Conectado"
                : wppState === "connecting"
                  ? "Conectando..."
                  : "Desconectado"}
            </span>
          )}
        </div>
      </div>

      {/* NAV */}
      <nav className="flex-1 px-3 mt-2 space-y-1 overflow-y-auto">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl text-sm font-medium transition-all",
                collapsed ? "justify-center p-2.5" : "px-3 py-2.5",
                active
                  ? "bg-master-orange text-white shadow-lg shadow-master-orange/30"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* USER + TOGGLE + LOGOUT */}
      <div className="p-3 mt-2 space-y-1 border-t border-white/10">
        <div
          className={cn(
            "flex items-center gap-3 px-2 py-2 rounded-xl",
            !collapsed && "bg-white/5"
          )}
        >
          <div className="w-9 h-9 rounded-full bg-master-orange flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-md">
            {user.name.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">
                {user.name}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-master-orange-200 font-medium">
                {user.role}
              </div>
            </div>
          )}
        </div>
        <ThemeToggle collapsed={collapsed} />
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className={cn(
              "w-full flex items-center gap-3 rounded-xl text-sm text-red-300 hover:bg-red-500/10 hover:text-red-200 transition",
              collapsed ? "justify-center p-2.5" : "px-3 py-2.5"
            )}
            title="Sair"
          >
            <LogOut size={18} />
            {!collapsed && <span>Sair</span>}
          </button>
        </form>
      </div>
    </aside>
  );
}
