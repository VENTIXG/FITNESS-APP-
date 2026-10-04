"use client";

import * as React from "react";
import type { Locale } from "@/lib/domain";
import { format, getDictionary, type Dictionary, type Params } from "@/lib/i18n";

type I18nValue = { locale: Locale; t: Dictionary; f: (template: string, params?: Params) => string };

const I18nContext = React.createContext<I18nValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = React.useMemo<I18nValue>(
    () => ({ locale, t: getDictionary(locale), f: (template, params) => format(template, params, locale) }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n() {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used inside <I18nProvider>");
  return ctx;
}

/** Dictionary for the active locale: t.nutrition.addFood */
export function useT(): Dictionary {
  return useI18n().t;
}

/** Interpolation bound to the active locale: f(t.common.days, { count: 3 }) */
export function useF() {
  return useI18n().f;
}

export function useLocale(): Locale {
  return useI18n().locale;
}
