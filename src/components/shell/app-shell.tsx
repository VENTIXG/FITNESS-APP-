"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOffline } from "next/offline";
import * as React from "react";
import { Dumbbell, LogOut, Plus, Search, WifiOff } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { useT } from "@/components/providers/i18n-provider";
import { fmtClock } from "@/lib/format";
import { cn } from "@/lib/utils";
import { signOut } from "@/server/actions/auth";
import { CommandPalette } from "./command-palette";
import { activeBottomTab, BOTTOM_TABS, isActive, SIDEBAR_ITEMS } from "./nav-items";
import { QuickAdd, type QuickAddHandle } from "./quick-add";
import { ServiceWorkerRegistrar } from "./service-worker";

export type ShellWorkout = { id: string; name: string; startedAt: string } | null;

type ShellProps = {
  user: { name: string | null; email: string };
  activeWorkout: ShellWorkout;
  children: React.ReactNode;
};

const QuickAddContext = React.createContext<QuickAddHandle | null>(null);
/** Open quick-add flows from anywhere (e.g. dashboard "Log weight"). */
export function useQuickAdd() {
  return React.useContext(QuickAddContext);
}

const PaletteContext = React.createContext<(() => void) | null>(null);
export function useOpenSearch() {
  return React.useContext(PaletteContext);
}

function ElapsedSince({ iso }: { iso: string }) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <span className="tabular">{fmtClock((now - new Date(iso).getTime()) / 1000)}</span>;
}

function OfflineBanner() {
  const t = useT();
  const offline = useOffline();
  if (!offline) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[70] flex justify-center px-3 pt-[calc(env(safe-area-inset-top)+8px)]">
      <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-[13px] text-fg shadow-pop">
        <WifiOff className="size-4 text-warn-text" aria-hidden />
        {t.common.offline}
      </div>
    </div>
  );
}

export function AppShell({ user, activeWorkout, children }: ShellProps) {
  const t = useT();
  const pathname = usePathname();
  const quickAddRef = React.useRef<QuickAddHandle>(null);
  const [quickAdd, setQuickAdd] = React.useState<QuickAddHandle | null>(null);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const inWorkout = pathname.startsWith("/training/workout/");
  const bottomActive = activeBottomTab(pathname);
  const openPalette = React.useCallback(() => setPaletteOpen(true), []);

  React.useEffect(() => setQuickAdd(quickAddRef.current), []);

  return (
    <QuickAddContext.Provider value={quickAdd}>
      <PaletteContext.Provider value={openPalette}>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-xl focus:bg-surface focus:px-4 focus:py-2">
          {t.nav.skipToContent}
        </a>
        <OfflineBanner />

        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-border bg-surface/50 backdrop-blur-xl lg:flex">
          <div className="flex h-16 shrink-0 items-center px-5">
            <Link href="/" aria-label={t.nav.dashboard} className="rounded-lg">
              <Logo />
            </Link>
          </div>
          <div className="flex gap-2 px-3 pb-3">
            <button
              type="button"
              onClick={() => quickAdd?.open()}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-accent-fg shadow-sm transition hover:bg-accent/90 active:scale-[0.98]"
            >
              <Plus className="size-4" strokeWidth={2.5} aria-hidden />
              {t.nav.quickAdd}
            </button>
            <button
              type="button"
              onClick={openPalette}
              aria-label={t.nav.search}
              className="flex size-10 items-center justify-center rounded-xl border border-border bg-surface-2 text-fg-2 transition hover:text-fg"
              title="⌘K"
            >
              <Search className="size-4" aria-hidden />
            </button>
          </div>
          {activeWorkout && !inWorkout && (
            <Link
              href={`/training/workout/${activeWorkout.id}`}
              className="mx-3 mb-3 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft px-3 py-2.5 text-sm transition hover:border-accent/60"
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-accent" />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{activeWorkout.name}</span>
              <span className="text-fg-2">
                <ElapsedSince iso={activeWorkout.startedAt} />
              </span>
            </Link>
          )}
          <nav aria-label={t.nav.mainNavigation} className="flex-1 overflow-y-auto px-3 pb-3">
            <ul className="flex flex-col gap-0.5">
              {SIDEBAR_ITEMS.map((item) => {
                const active = isActive(item.href, pathname);
                const Icon = item.icon;
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                        active ? "bg-surface-2 text-fg dark:bg-surface-3/70" : "text-fg-2 hover:bg-surface-2/70 hover:text-fg",
                      )}
                    >
                      <Icon className={cn("size-[18px] shrink-0", active ? "text-accent" : "text-fg-3 group-hover:text-fg-2")} aria-hidden />
                      {t.nav[item.key]}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="flex items-center gap-3 border-t border-border px-4 py-3.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-sm font-semibold text-fg">
              {(user.name || user.email).slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-fg">{user.name || user.email}</div>
              {user.name && <div className="truncate text-xs text-fg-3">{user.email}</div>}
            </div>
            <form action={signOut}>
              <button
                type="submit"
                aria-label={t.nav.signOut}
                title={t.nav.signOut}
                className="flex size-8 items-center justify-center rounded-lg text-fg-3 transition hover:bg-surface-2 hover:text-fg"
              >
                <LogOut className="size-4" aria-hidden />
              </button>
            </form>
          </div>
        </aside>

        <main id="main" className="min-h-dvh lg:pl-[248px]">
          <div
            className={cn(
              "mx-auto w-full max-w-6xl px-4 pt-[calc(env(safe-area-inset-top)+18px)] sm:px-6 lg:px-10 lg:pt-8 lg:pb-14",
              inWorkout ? "pb-40" : "pb-36",
            )}
          >
            {children}
          </div>
        </main>

        {/* Mobile: active workout pill */}
        {activeWorkout && !inWorkout && (
          <Link
            href={`/training/workout/${activeWorkout.id}`}
            className="fixed inset-x-4 z-40 flex items-center gap-3 rounded-2xl border border-accent/30 bg-surface/95 px-4 py-3 text-sm shadow-pop backdrop-blur-xl lg:hidden"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}
          >
            <Dumbbell className="size-4 text-accent" aria-hidden />
            <span className="min-w-0 flex-1 truncate font-medium">{activeWorkout.name}</span>
            <span className="text-fg-2">
              <ElapsedSince iso={activeWorkout.startedAt} />
            </span>
          </Link>
        )}

        {/* Mobile: floating quick add */}
        {!inWorkout && !activeWorkout && (
          <button
            type="button"
            onClick={() => quickAdd?.open()}
            aria-label={t.nav.quickAdd}
            className="fixed right-4 z-40 flex size-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-pop transition active:scale-95 lg:hidden"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 80px)" }}
          >
            <Plus className="size-6" strokeWidth={2.5} aria-hidden />
          </button>
        )}

        {/* Mobile bottom tab bar */}
        <nav
          aria-label={t.nav.mainNavigation}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/88 pb-safe backdrop-blur-xl lg:hidden"
        >
          <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
            {BOTTOM_TABS.map((tab) => {
              const active = bottomActive === tab.href;
              const Icon = tab.icon;
              return (
                <li key={tab.key}>
                  <Link
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                      active ? "text-fg" : "text-fg-3",
                    )}
                  >
                    <Icon className={cn("size-[22px]", active && "text-accent")} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                    {t.nav[tab.key]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <QuickAdd ref={quickAddRef} />
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        <ServiceWorkerRegistrar />
      </PaletteContext.Provider>
    </QuickAddContext.Provider>
  );
}
