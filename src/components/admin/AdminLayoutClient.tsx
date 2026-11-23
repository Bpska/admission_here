"use client";

import { useEffect, useRef, useState } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { AdminSidebar } from "./AdminSidebar";
import { Menu, PanelLeftClose, PanelLeftOpen, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface AdminLayoutClientProps {
  children: React.ReactNode;
  role: string;
  permissions: string[];
  userName: string;
  userEmail: string;
  userDesignation?: string | null;
}

export function AdminLayoutClient({
  children,
  role,
  permissions,
  userName,
  userEmail,
  userDesignation,
}: AdminLayoutClientProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const drawerRef = useRef<HTMLDivElement>(null);
  const desktopToggleRef = useRef<HTMLButtonElement>(null);
  useScrollLock(mobileSidebarOpen);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (media.matches) setMobileSidebarOpen(false); };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    drawerRef.current?.querySelector<HTMLButtonElement>('button[aria-label="Close sidebar"]')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setMobileSidebarOpen(false); }
      if (event.key !== "Tab") return;
      const items = drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      const first = items?.[0]; const last = items?.[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("keydown", handleKey); previouslyFocused?.focus(); };
  }, [mobileSidebarOpen]);

  function closeDesktopSidebar() {
    setDesktopSidebarOpen(false);
    desktopToggleRef.current?.focus();
  }

  return (
    <div className="h-dvh flex overflow-hidden bg-muted/20">
      {/* Desktop navigation can be hidden to give the content more room. */}
      {desktopSidebarOpen && <div id="admin-desktop-sidebar" className="hidden lg:block w-60 xl:w-64 h-full shrink-0">
        <AdminSidebar
          role={role}
          permissions={permissions}
          userName={userName}
          userEmail={userEmail}
          userDesignation={userDesignation}
          onClose={closeDesktopSidebar}
        />
      </div>}

      {/* Mobile Sidebar Slide-Over Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop overlay */}
          <button type="button" tabIndex={-1} aria-label="Close navigation backdrop" className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={() => setMobileSidebarOpen(false)} />

          {/* Drawer container */}
          <div id="admin-mobile-sidebar" ref={drawerRef} role="dialog" aria-modal="true" aria-label="Administration navigation" className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200 motion-reduce:animate-none">
            <AdminSidebar
              role={role}
              permissions={permissions}
              userName={userName}
              userEmail={userEmail}
              userDesignation={userDesignation}
              onClose={() => setMobileSidebarOpen(false)}
              onNavigate={() => setMobileSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div inert={mobileSidebarOpen} className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Admin Top Header */}
        <header className="h-16 shrink-0 border-b bg-card px-3 sm:px-6 flex items-center justify-between z-30 shadow-2xs gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              ref={desktopToggleRef}
              type="button"
              onClick={() => setDesktopSidebarOpen(value => !value)}
              aria-label={desktopSidebarOpen ? "Close navigation sidebar" : "Open navigation sidebar"}
              aria-expanded={desktopSidebarOpen}
              aria-controls="admin-desktop-sidebar"
              title={desktopSidebarOpen ? "Close sidebar" : "Open sidebar"}
              className="hidden lg:inline-flex h-11 w-11 shrink-0 items-center justify-center p-2 rounded-lg hover:bg-muted text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-primary"
            >
              {desktopSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
            </button>
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-expanded={mobileSidebarOpen}
              aria-controls="admin-mobile-sidebar"
              className="lg:hidden inline-flex h-11 w-11 shrink-0 items-center justify-center p-2 rounded-lg hover:bg-muted text-foreground transition-colors cursor-pointer"
              aria-label="Open navigation sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Mobile Logo Brand */}
            <Link href="/admin" className="lg:hidden flex items-center shrink-0">
              <Image
                src="/logo.png"
                alt="Admission Here"
                width={120}
                height={32}
                className="h-7 w-24 sm:w-28 object-contain"
              />
            </Link>

            {/* Active Role Pill */}
            <span
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
              style={{
                backgroundColor:
                  role === "STAFF"
                    ? "rgba(26, 48, 104, 0.1)"
                    : "rgba(31, 128, 64, 0.12)",
                color: role === "STAFF" ? "#1a3068" : "#1f8040",
              }}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                {role === "STAFF" ? `Staff · ${permissions.length} modules` : role === "AUTHOR" ? "Author" : "Super Admin"}
              </span>
            </span>
          </div>

          {/* User Status */}
          <div className="flex min-w-0 items-center gap-2 text-xs">
            <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <span className="hidden xs:inline">User:</span>
              <div className="min-w-0 text-right">
                <strong className="block text-foreground max-w-[88px] min-[400px]:max-w-[120px] sm:max-w-[180px] truncate font-medium">{userName}</strong>
                {userDesignation && <p title={userDesignation} className="max-w-[88px] min-[400px]:max-w-[120px] sm:max-w-[180px] truncate text-[10px] text-muted-foreground">{userDesignation}</p>}
              </div>
            </div>


          </div>
        </header>

        {/* Content Viewport */}
        <main id="admin-main-content" className="flex-1 overflow-y-auto overscroll-contain min-w-0 min-h-0 p-3 sm:p-6 xl:p-8">
          <div className="admin-content mx-auto w-full min-w-0 max-w-screen-2xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

