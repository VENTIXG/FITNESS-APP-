"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import * as React from "react";
import { useT } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";

/**
 * Responsive modal: a bottom sheet on phones (drag the handle down to dismiss),
 * a centered dialog on larger screens. Built on Radix Dialog for focus trapping,
 * Esc handling and aria wiring.
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

type SheetContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  hideTitle?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  footer?: React.ReactNode;
  /** Remove default body padding (for full-bleed lists). */
  flush?: boolean;
  headerAction?: React.ReactNode;
};

const sizes = { sm: "sm:max-w-sm", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" } as const;

export function SheetContent({
  title,
  description,
  hideTitle,
  size = "md",
  footer,
  flush,
  headerAction,
  className,
  children,
  ...props
}: SheetContentProps) {
  const t = useT();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{ startY: number; dy: number; t0: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (window.matchMedia("(min-width: 640px)").matches) return;
    drag.current = { startY: e.clientY, dy: 0, t0: performance.now() };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !contentRef.current) return;
    const dy = Math.max(0, e.clientY - drag.current.startY);
    drag.current.dy = dy;
    contentRef.current.style.transition = "none";
    contentRef.current.style.transform = `translate3d(0, ${dy}px, 0)`;
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    const el = contentRef.current;
    if (!d || !el) return;
    const velocity = d.dy / Math.max(1, performance.now() - d.t0);
    el.style.transition = "transform 220ms cubic-bezier(0.32, 0.72, 0, 1)";
    if (d.dy > 120 || velocity > 0.6) {
      el.style.transform = "translate3d(0, 100%, 0)";
      window.setTimeout(() => {
        el.style.transform = "";
        el.style.transition = "";
        (el.querySelector("[data-sheet-close]") as HTMLButtonElement | null)?.click();
      }, 200);
    } else {
      el.style.transform = "";
    }
  };

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        ref={contentRef}
        aria-describedby={description ? undefined : undefined}
        className={cn(
          "fixed z-50 flex max-h-[92dvh] w-full flex-col border border-border bg-surface shadow-pop outline-none",
          "inset-x-0 bottom-0 rounded-t-[28px] pb-safe data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out",
          "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[86dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:pb-0",
          "sm:data-[state=open]:animate-pop-in sm:data-[state=closed]:animate-out sm:data-[state=closed]:fade-out-0 sm:data-[state=closed]:zoom-out-95",
          sizes[size],
          className,
        )}
        {...props}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center pt-2.5 pb-1 sm:hidden"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-hidden
        >
          <div className="h-1.5 w-10 rounded-full bg-border-strong" />
        </div>
        <div
          className={cn("flex shrink-0 items-start justify-between gap-3 px-5 pt-2 pb-3 sm:pt-5", hideTitle && "sr-only")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-lg font-semibold tracking-tight text-fg">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-0.5 text-sm text-fg-3">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>
          <div className="flex items-center gap-1">
            {headerAction}
            <DialogPrimitive.Close
              data-sheet-close
              className="-mr-1.5 flex size-9 items-center justify-center rounded-full text-fg-3 transition hover:bg-surface-2 hover:text-fg"
              aria-label={t.common.close}
            >
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>
        </div>
        <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", !flush && "px-5 pb-5")}>{children}</div>
        {footer && <div className="shrink-0 border-t border-border bg-surface px-5 py-3.5 sm:rounded-b-3xl">{footer}</div>}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
