"use client";

import { ThemeProvider, useTheme } from "next-themes";
import * as React from "react";
import { Toaster } from "sonner";
import type { Locale, ThemePreference } from "@/lib/domain";
import { I18nProvider } from "./i18n-provider";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={(resolvedTheme as "light" | "dark") ?? "dark"}
      position="top-center"
      offset={16}
      mobileOffset={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
      visibleToasts={3}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-2xl !border !border-border !bg-surface !text-fg !shadow-pop !font-sans !text-sm !gap-3 !px-4 !py-3.5",
          description: "!text-fg-3",
          actionButton: "!bg-fg !text-bg !rounded-lg !font-medium",
          cancelButton: "!bg-surface-2 !text-fg !rounded-lg",
          success: "[&_[data-icon]]:!text-good",
          error: "[&_[data-icon]]:!text-critical",
        },
      }}
    />
  );
}

export function AppProviders({
  locale,
  theme,
  nonce,
  children,
}: {
  locale: Locale;
  theme: ThemePreference;
  nonce?: string;
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme={theme} enableSystem disableTransitionOnChange nonce={nonce}>
      <I18nProvider locale={locale}>
        {children}
        <ThemedToaster />
      </I18nProvider>
    </ThemeProvider>
  );
}
