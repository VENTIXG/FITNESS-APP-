"use client";

import * as React from "react";
import { Bell, Minus, Plus, SkipForward, Timer } from "lucide-react";
import { useT } from "@/components/providers/i18n-provider";
import { usePrefs } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { fmtClock } from "@/lib/format";
import { cn } from "@/lib/utils";

type RestState = { endsAt: number; total: number } | null;
const KEY = "forge:rest";

function readStored(): RestState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as RestState;
    return v && v.endsAt > Date.now() ? v : null;
  } catch {
    return null;
  }
}

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const tones = [0, 0.18, 0.36];
    for (const at of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.15);
    }
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    // Audio blocked — vibration/notification still apply.
  }
}

/**
 * Rest timer driven by an absolute end timestamp (persisted), so it stays correct
 * across re-renders, navigation and the tab being backgrounded.
 */
export function useRestTimer() {
  const t = useT();
  const prefs = usePrefs();
  const [rest, setRest] = React.useState<RestState>(null);
  const [now, setNow] = React.useState(() => Date.now());
  const firedFor = React.useRef<number | null>(null);

  // Restore a running timer after reload (client-only state).
  React.useEffect(() => {
    const stored = readStored();
    if (stored) setRest(stored); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const persist = (v: RestState) => {
    setRest(v);
    try {
      if (v) localStorage.setItem(KEY, JSON.stringify(v));
      else localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  };

  React.useEffect(() => {
    if (!rest) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [rest]);

  const remaining = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;

  React.useEffect(() => {
    if (!rest || remaining > 0 || firedFor.current === rest.endsAt) return;
    firedFor.current = rest.endsAt;
    if (prefs.training.restVibrate && "vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
    if (prefs.training.restSound) beep();
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
      navigator.serviceWorker?.ready
        .then((reg) => reg.showNotification(t.training.rest.notificationTitle, { body: t.training.rest.notificationBody, tag: "rest-timer", icon: "/icons/icon-192.png" }))
        .catch(() => new Notification(t.training.rest.notificationTitle, { body: t.training.rest.notificationBody, tag: "rest-timer" }));
    }
    const id = window.setTimeout(() => persist(null), 2500);
    return () => window.clearTimeout(id);
  }, [remaining, rest, prefs.training.restVibrate, prefs.training.restSound, t]);

  return {
    rest,
    remaining,
    start: (seconds: number) => {
      if (seconds <= 0) return;
      firedFor.current = null;
      setNow(Date.now());
      persist({ endsAt: Date.now() + seconds * 1000, total: seconds });
    },
    adjust: (delta: number) => {
      if (!rest) return;
      const endsAt = Math.max(Date.now() + 1000, rest.endsAt + delta * 1000);
      persist({ endsAt, total: Math.max(rest.total + delta, 1) });
    },
    stop: () => persist(null),
  };
}

export type RestTimer = ReturnType<typeof useRestTimer>;

export function RestTimerBar({ timer }: { timer: RestTimer }) {
  const t = useT();
  const [permission, setPermission] = React.useState<NotificationPermission | "unsupported">(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  if (!timer.rest) return null;
  const done = timer.remaining === 0;
  const progress = 1 - timer.remaining / Math.max(1, timer.rest.total);
  return (
    <div
      className={cn(
        "fixed inset-x-0 z-40 mx-auto max-w-xl px-3 transition-all",
        "bottom-[calc(env(safe-area-inset-bottom)+76px)] lg:bottom-6",
      )}
      role="timer"
      aria-live="polite"
      aria-label={t.training.rest.title}
    >
      <div className={cn("overflow-hidden rounded-2xl border shadow-pop backdrop-blur", done ? "border-good bg-good/15" : "border-border bg-surface/95")}>
        <div className="h-1 bg-surface-3">
          <div className="h-full bg-accent transition-[width] duration-300 ease-linear" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="flex items-center gap-2 px-3 py-2">
          <Timer className={cn("size-5 shrink-0", done ? "text-good-text" : "text-accent")} aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium tracking-wide text-fg-3 uppercase">{done ? t.training.rest.done : t.training.rest.title}</div>
            <div className="text-xl leading-tight font-semibold tabular">{fmtClock(timer.remaining)}</div>
          </div>
          {permission === "default" && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t.training.rest.notificationTitle}
              onClick={async () => setPermission(await Notification.requestPermission())}
            >
              <Bell />
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => timer.adjust(-15)} aria-label={t.training.rest.sub15}>
            <Minus aria-hidden />
            15
          </Button>
          <Button variant="secondary" size="sm" onClick={() => timer.adjust(15)} aria-label={t.training.rest.add15}>
            <Plus aria-hidden />
            15
          </Button>
          <Button variant="primary" size="sm" onClick={timer.stop}>
            <SkipForward aria-hidden />
            {t.training.rest.skip}
          </Button>
        </div>
      </div>
    </div>
  );
}
