import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

export const buttonVariants = cva(
  [
    "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium",
    "transition-[background-color,color,border-color,box-shadow,transform,opacity] duration-150 ease-out",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-fg text-bg shadow-sm hover:bg-fg/88",
        accent: "bg-accent text-accent-fg shadow-sm hover:bg-accent/90",
        secondary: "border border-border bg-surface-2 text-fg hover:border-border-strong hover:bg-surface-3",
        outline: "border border-border-strong bg-transparent text-fg hover:bg-surface-2",
        ghost: "bg-transparent text-fg-2 hover:bg-surface-2 hover:text-fg",
        destructive: "bg-critical text-white shadow-sm hover:bg-critical/90",
        "destructive-ghost": "bg-transparent text-critical-text hover:bg-critical/10",
        link: "h-auto bg-transparent px-0 text-fg underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-7 rounded-lg px-2.5 text-xs [&_svg]:size-3.5",
        sm: "h-8 rounded-lg px-3 text-[13px] [&_svg]:size-4",
        md: "h-10 rounded-xl px-4 text-sm [&_svg]:size-4",
        lg: "h-12 rounded-2xl px-5 text-[15px] [&_svg]:size-5",
        xl: "h-14 rounded-2xl px-6 text-base [&_svg]:size-5",
        icon: "size-10 rounded-xl [&_svg]:size-5",
        "icon-sm": "size-8 rounded-lg [&_svg]:size-4",
        "icon-lg": "size-12 rounded-2xl [&_svg]:size-5",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

export function Button({ className, variant, size, block, asChild, loading, disabled, children, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Spinner className="size-4" />}
          {children}
        </>
      )}
    </Comp>
  );
}
