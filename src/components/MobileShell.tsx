"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { Logo } from "@/components/Logo";
import { PwaAndNotifications } from "@/components/PwaAndNotifications";

interface ShellProps {
  workspaceId: string;
  user: { name: string; email: string; role: string; avatar: string | null };
  children: React.ReactNode;
}

/**
 * Shell client-side que gerencia o drawer mobile da sidebar.
 *
 * Mobile (<md): topbar com hamburger + logo, sidebar fica como drawer
 * Desktop: sidebar fixa lateral normal
 */
export function MobileShell({ workspaceId, user, children }: ShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        workspaceId={workspaceId}
        user={user}
        mobileOpen={menuOpen}
        onMobileClose={() => setMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-100 dark:bg-slate-950">
        {/* TOPBAR MOBILE - hamburger + logo */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-master-navy text-white shrink-0">
          <button
            onClick={() => setMenuOpen(true)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <Logo variant="white" size="sm" />
        </header>

        <main className="flex-1 overflow-hidden">{children}</main>
      </div>

      <PwaAndNotifications workspaceId={workspaceId} />
    </div>
  );
}
