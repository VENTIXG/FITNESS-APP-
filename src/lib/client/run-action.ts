"use client";

import * as React from "react";
import { toast } from "sonner";
import { useT } from "@/components/providers/i18n-provider";
import type { Dictionary } from "@/lib/i18n";
import type { ActionResult } from "@/server/actions/_lib";

export function actionErrorMessage(t: Dictionary, code: string): string {
  switch (code) {
    case "unauthorized":
      return t.errors.unauthorized;
    case "validation":
      return t.errors.validation;
    case "duplicate":
      return t.errors.duplicateEntry;
    case "not_found":
      return t.errors.notFound;
    case "future_date":
      return t.errors.futureDate;
    case "in_use":
      return t.errors.inUse;
    case "wrongPassword":
      return t.auth.wrongPassword;
    default:
      return t.errors.generic;
  }
}

type RunOptions = { success?: string; error?: string; silent?: boolean };
export type RunResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Runs a server action, shows a toast for success/failure and never throws.
 * Network failures are reported as such (the action is retried by Next when
 * `experimental.useOffline` detects reconnection).
 */
export function useRun() {
  const t = useT();
  const [pending, setPending] = React.useState(false);
  const run = React.useCallback(
    async <T,>(fn: () => Promise<ActionResult<T>>, opts: RunOptions = {}): Promise<RunResult<T>> => {
      setPending(true);
      try {
        const res = await fn();
        if (res.ok) {
          if (opts.success) toast.success(opts.success);
          return { ok: true, data: res.data };
        }
        if (!opts.silent) toast.error(opts.error ?? actionErrorMessage(t, res.error));
        return { ok: false, error: res.error };
      } catch {
        if (!opts.silent) toast.error(typeof navigator !== "undefined" && !navigator.onLine ? t.errors.network : t.errors.generic);
        return { ok: false, error: "network" };
      } finally {
        setPending(false);
      }
    },
    [t],
  );
  return { run, pending };
}
