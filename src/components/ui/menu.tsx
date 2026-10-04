"use client";

import { DropdownMenu } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({ className, align = "end", sideOffset = 6, ...props }: React.ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-48 overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-pop",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className,
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}

export function MenuItem({
  className,
  destructive,
  icon,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenu.Item> & { destructive?: boolean; icon?: React.ReactNode }) {
  return (
    <DropdownMenu.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm outline-none transition-colors",
        "data-[highlighted]:bg-surface-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        destructive ? "text-critical-text" : "text-fg",
        "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-current",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </DropdownMenu.Item>
  );
}

export function MenuSeparator({ className }: { className?: string }) {
  return <DropdownMenu.Separator className={cn("my-1 h-px bg-border", className)} />;
}

export function MenuLabel({ className, ...props }: React.ComponentProps<typeof DropdownMenu.Label>) {
  return <DropdownMenu.Label className={cn("px-3 pt-2 pb-1 text-xs font-medium text-fg-3", className)} {...props} />;
}
