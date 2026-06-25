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
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserAvatar } from "@/components/UserAvatar";
import { getPusherClient } from "@/lib/pusher-client";
import { cn } from "@/lib/cn";

interface SidebarProps {
  workspaceId: string;
  user: { name: string; email: string; role: string; avatar: string | null };
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/conversations", label: "Conversas", icon: MessagesSquare },
  { href: "/pipeline", label: "Pipeline", icon: Columns3 },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/contatos", label: "Contatos", icon: Users },
  { href: "/etiquetas", label: "Etiquetas", icon: Tag },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function Sidebar({
  workspaceId,
  user,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
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

  // Fecha drawer ao navegar entre paginas (mobile)
  useEffect(() => {
    if (onMobileClose) onMobileClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* OVERLAY mobile */}
      {mobileOpen && (
        <button
          onClick={onMobileClose}
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-black/50 md:hidden backdrop-blur-sm"
        />
      )}

      <aside
        className={cn(
          "h-screen flex flex-col gradient-master-navy text-slate-100 transition-transform duration-200 ease-out z-50",
          // Mobile: drawer fixed slide-in
          "fixed inset-y-0 left-0 w-72",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: volta pro fluxo normal e ocupa espaco no flex
          "md:relative md:translate-x-0 md:shrink-0",
          collapsed ? "md:w-[68px]" : "md:w-64"
        )}
      >
        {/* LOGO + close mobile */}
        <div className="px-4 pt-5 pb-4 flex items-center justify-between">
          {!collapsed ? (
            <span className="text-white text-2xl font-black tracking-[0.18em] leading-none select-none">
              MASTER
            </span>
          ) : (
            <div className="w-full flex justify-center">
              <span className="text-white text-sm font-black tracking-[0.15em] leading-none select-none">
                M
              </span>
            </div>
          )}
          {/* X close apenas no mobile */}
          {onMobileClose && (
            <button
              onClick={onMobileClose}
              className="md:hidden p-1.5 rounded-lg hover:bg-white/10 transition"
              aria-label="Fechar menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* COLLAPSE BUTTON (desktop only) */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="hidden md:flex absolute -right-3 top-7 w-6 h-6 rounded-full bg-white text-master-navy hover:bg-master-orange hover:text-white shadow-lg items-center justify-center transition z-10"
          title={collapsed ? "Expandir" : "Recolher"}
        >
          <ChevronLeft size={14} className={cn("transition", collapsed && "rotate-180")} />
        </button>

        {/* STATUS WhatsApp */}
        <div className={cn("px-4 mb-2", collapsed && "md:px-2")}>
          <div
            className={cn(
              "flex items-center gap-2 text-xs",
              collapsed && "md:justify-center"
            )}
          >
            {wppState === "open" ? (
              <Wifi size={13} className="text-emerald-400 shrink-0" />
            ) : wppState === "connecting" ? (
              <Wifi size={13} className="text-amber-400 shrink-0 animate-pulse" />
            ) : (
              <WifiOff size={13} className="text-red-400 shrink-0" />
            )}
            <span
              className={cn(
                "font-medium",
                collapsed && "md:hidden",
                wppState === "open"
                  ? "text-emerald-400"
                  : wppState === "connecting"
                    ? "text-amber-400"
                    : "text-red-400"
              )}
            >
              {wppState === "open"
                ? "WhatsApp conectado"
                : wppState === "connecting"
                  ? "Conectando..."
                  : "Desconectado"}
            </span>
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
                onClick={onMobileClose}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98]",
                  collapsed ? "md:justify-center md:p-2.5 px-3 py-2.5" : "px-3 py-2.5",
                  active
                    ? "bg-master-orange text-white shadow-lg shadow-master-orange/30"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                )}
                title={collapsed ? item.label : undefined}
              >
                {/* Indicador lateral fino no item ativo (estilo Linear) */}
                {active && !collapsed && (
                  <span
                    aria-hidden="true"
                    className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r-full shadow-md"
                  />
                )}
                <Icon size={18} className="shrink-0" />
                <span className={cn(collapsed && "md:hidden")}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* USER + TOGGLE + LOGOUT */}
        <div className="p-3 mt-2 space-y-1 border-t border-white/10">
          <div
            className={cn(
              "flex items-center gap-3 px-2 py-2 rounded-xl",
              !collapsed && "bg-white/5",
              collapsed && "md:bg-transparent bg-white/5"
            )}
          >
            <UserAvatar
              name={user.name}
              avatar={user.avatar}
              size={36}
              ring
              className="shadow-md"
            />
            <div className={cn("flex-1 min-w-0", collapsed && "md:hidden")}>
              <div className="text-sm font-semibold text-white truncate">
                {user.name}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-master-orange-200 font-medium">
                {user.role}
              </div>
            </div>
          </div>
          <ThemeToggle collapsed={collapsed} />
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className={cn(
                "w-full flex items-center gap-3 rounded-xl text-sm text-red-300 hover:bg-red-500/10 hover:text-red-200 transition",
                collapsed ? "md:justify-center md:p-2.5 px-3 py-2.5" : "px-3 py-2.5"
              )}
              title="Sair"
            >
              <LogOut size={18} />
              <span className={cn(collapsed && "md:hidden")}>Sair</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
