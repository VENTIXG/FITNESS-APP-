"use client";

import { AlertDialog } from "radix-ui";
import * as React from "react";
import { useT } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Input } from "./input";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  destructive?: boolean;
  /** Require typing this word before confirming (for irreversible actions). */
  confirmWord?: string;
  confirmWordLabel?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive,
  confirmWord,
  confirmWordLabel,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const t = useT();
  const [busy, setBusy] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setTyped("");
  }
  const blocked = confirmWord ? typed.trim() !== confirmWord : false;

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-overlay backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <AlertDialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-surface p-6 shadow-pop",
            "data-[state=open]:animate-pop-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
        >
          <AlertDialog.Title className="text-lg font-semibold tracking-tight">{title}</AlertDialog.Title>
          {description ? (
            <AlertDialog.Description className="mt-2 text-sm leading-relaxed text-fg-2">{description}</AlertDialog.Description>
          ) : (
            <AlertDialog.Description className="sr-only">{title}</AlertDialog.Description>
          )}
          {children}
          {confirmWord && (
            <div className="mt-4 space-y-1.5">
              <p className="text-[13px] text-fg-2">{confirmWordLabel}</p>
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" autoComplete="off" aria-label={String(confirmWordLabel ?? confirmWord)} />
            </div>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">{cancelLabel ?? t.common.cancel}</Button>
            </AlertDialog.Cancel>
            <Button
              variant={destructive ? "destructive" : "primary"}
              loading={busy}
              disabled={blocked}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  onOpenChange(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirmLabel ?? t.common.confirm}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/** Imperative helper: const confirm = useConfirm(); if (await confirm({...})) … */
export function useConfirm() {
  const [state, setState] = React.useState<(Omit<ConfirmDialogProps, "open" | "onOpenChange" | "onConfirm"> & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = React.useCallback(
    (opts: Omit<ConfirmDialogProps, "open" | "onOpenChange" | "onConfirm">) =>
      new Promise<boolean>((resolve) => setState({ ...opts, resolve })),
    [],
  );
  const dialog = state ? (
    <ConfirmDialog
      {...state}
      open
      onOpenChange={(open) => {
        if (!open) {
          state.resolve(false);
          setState(null);
        }
      }}
      onConfirm={() => {
        state.resolve(true);
        setState(null);
      }}
    />
  ) : null;
  return { confirm, dialog };
}
