"use client";

import * as React from "react";
import type { ISODate } from "@/lib/dates";
import { todayInTimeZone } from "@/lib/dates";
import type { UnitSystem } from "@/lib/domain";
import { createFormatter, type Formatter } from "@/lib/format";
import type { MealSlot, TrainingPrefs } from "@/lib/preferences";
import { useLocale } from "./i18n-provider";

/** Client-safe subset of the user's preferences (no secrets, no PII beyond display name). */
export type ClientPrefs = {
  displayName: string | null;
  unitSystem: UnitSystem;
  timezone: string;
  weekStartsOn: number;
  /** Server-computed today at render time (re-derived on the client to survive midnight). */
  today: ISODate;
  training: TrainingPrefs;
  mealSlots: MealSlot[];
  stepGoal: number;
  waterGoalMl: number;
  sleepGoalMinutes: number;
  showSugar: boolean;
  showSodium: boolean;
};

const PrefsContext = React.createContext<ClientPrefs | null>(null);

export function PrefsProvider({ prefs, children }: { prefs: ClientPrefs; children: React.ReactNode }) {
  return <PrefsContext.Provider value={prefs}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): ClientPrefs {
  const ctx = React.useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used inside <PrefsProvider>");
  return ctx;
}

/** Optional variant for components that also render on signed-out pages. */
export function useOptionalPrefs(): ClientPrefs | null {
  return React.useContext(PrefsContext);
}

/** Today's date in the user's timezone, evaluated on the client at call time. */
export function useToday(): ISODate {
  const prefs = usePrefs();
  const [today, setToday] = React.useState(prefs.today);
  React.useEffect(() => {
    const update = () => setToday(todayInTimeZone(prefs.timezone));
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, [prefs.timezone]);
  return today;
}

/** Locale + unit-aware formatter. */
export function useFmt(): Formatter {
  const locale = useLocale();
  const prefs = useOptionalPrefs();
  const units = prefs?.unitSystem ?? "metric";
  return React.useMemo(() => createFormatter(locale, units), [locale, units]);
}

/** Localized display name of a meal slot (custom name if set). */
export function useMealSlotName() {
  const prefs = usePrefs();
  return React.useCallback(
    (slotId: string, fallbackNames: Record<string, string>) => {
      const slot = prefs.mealSlots.find((s) => s.id === slotId);
      return slot?.name || fallbackNames[slotId] || slotId;
    },
    [prefs.mealSlots],
  );
}
