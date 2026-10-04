"use client";

import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { useOpenSearch } from "./app-shell";

export function SearchButton({ children }: { children: React.ReactNode }) {
  const t = useT();
  const open = useOpenSearch();
  return (
    <Button variant="secondary" size="icon" onClick={() => open?.()} aria-label={t.nav.search} className="lg:hidden">
      {children}
    </Button>
  );
}
