"use client";

import { Command } from "cmdk";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useRouter } from "next/navigation";
import * as React from "react";
import { BookOpen, ChefHat, Dumbbell, Layers, Search, UtensilsCrossed } from "lucide-react";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { normalizeSearch } from "@/lib/utils";
import type { SearchResults } from "@/server/queries/search";
import { SIDEBAR_ITEMS } from "./nav-items";

const EMPTY: SearchResults = { exercises: [], foods: [], meals: [], recipes: [], workouts: [], programs: [] };

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [rawResults, setResults] = React.useState<SearchResults>(EMPTY);
  const results = query.trim().length < 2 ? EMPTY : rawResults;
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setQuery("");
      setResults(EMPTY);
    }
  }

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const id = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (res.ok) setResults(await res.json());
      } catch {
        // aborted or offline — keep previous results
      } finally {
        setLoading(false);
      }
    }, 160);
    return () => {
      ctrl.abort();
      window.clearTimeout(id);
    };
  }, [query]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const pages = SIDEBAR_ITEMS.filter((p) => !query || normalizeSearch(t.nav[p.key]).includes(normalizeSearch(query)));
  const nameOf = (r: { name: string; nameEl?: string | null }) => (locale === "el" && r.nameEl ? r.nameEl : r.name);
  const item = "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-fg data-[selected=true]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-fg-3";
  const group = "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-3";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed inset-x-3 top-[max(env(safe-area-inset-top),12px)] z-50 mx-auto max-w-xl overflow-hidden rounded-3xl border border-border bg-surface shadow-pop data-[state=open]:animate-pop-in sm:top-[12vh]">
          <DialogPrimitive.Title className="sr-only">{t.search.title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{t.search.placeholder}</DialogPrimitive.Description>
          <Command shouldFilter={false} label={t.search.title}>
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="size-5 text-fg-3" aria-hidden />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder={t.search.placeholder}
                className="h-14 w-full bg-transparent text-[15px] text-fg outline-none placeholder:text-fg-3"
              />
            </div>
            <Command.List className="max-h-[60dvh] overflow-y-auto p-2">
              {query.trim().length >= 2 && !loading && (
                <Command.Empty className="px-3 py-8 text-center text-sm text-fg-3">{t.search.noResults}</Command.Empty>
              )}
              {pages.length > 0 && (
                <Command.Group heading={t.search.groups.pages} className={group}>
                  {pages.map((p) => {
                    const Icon = p.icon;
                    return (
                      <Command.Item key={p.key} value={`page-${p.key}`} onSelect={() => go(p.href)} className={item}>
                        <Icon aria-hidden />
                        {t.nav[p.key]}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              )}
              {results.exercises.length > 0 && (
                <Command.Group heading={t.search.groups.exercises} className={group}>
                  {results.exercises.map((r) => (
                    <Command.Item key={r.id} value={`ex-${r.id}`} onSelect={() => go(`/training/exercises/${r.id}`)} className={item}>
                      <Dumbbell aria-hidden />
                      <span className="flex-1 truncate">{nameOf(r)}</span>
                      <span className="text-xs text-fg-3">{t.enums.muscle[r.muscleGroup as keyof typeof t.enums.muscle]}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {results.foods.length > 0 && (
                <Command.Group heading={t.search.groups.foods} className={group}>
                  {results.foods.map((r) => (
                    <Command.Item key={r.id} value={`food-${r.id}`} onSelect={() => go(`/nutrition/foods/${r.id}`)} className={item}>
                      <UtensilsCrossed aria-hidden />
                      <span className="flex-1 truncate">
                        {nameOf(r)}
                        {r.brand && <span className="text-fg-3"> · {r.brand}</span>}
                      </span>
                      <span className="text-xs text-fg-3 tabular">
                        {Math.round(r.calories)} kcal/100{r.baseUnit}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {results.meals.length > 0 && (
                <Command.Group heading={t.search.groups.meals} className={group}>
                  {results.meals.map((r) => (
                    <Command.Item key={r.id} value={`meal-${r.id}`} onSelect={() => go(`/nutrition/meals/${r.id}`)} className={item}>
                      <BookOpen aria-hidden />
                      {r.name}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {results.recipes.length > 0 && (
                <Command.Group heading={t.search.groups.recipes} className={group}>
                  {results.recipes.map((r) => (
                    <Command.Item key={r.id} value={`recipe-${r.id}`} onSelect={() => go(`/nutrition/recipes/${r.id}`)} className={item}>
                      <ChefHat aria-hidden />
                      {r.name}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {results.workouts.length > 0 && (
                <Command.Group heading={t.search.groups.workouts} className={group}>
                  {results.workouts.map((r) => (
                    <Command.Item key={r.id} value={`workout-${r.id}`} onSelect={() => go(`/training/workout/${r.id}`)} className={item}>
                      <Dumbbell aria-hidden />
                      <span className="flex-1 truncate">{r.name}</span>
                      <span className="text-xs text-fg-3 tabular">{r.date}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {results.programs.length > 0 && (
                <Command.Group heading={t.search.groups.programs} className={group}>
                  {results.programs.map((r) => (
                    <Command.Item key={r.id} value={`program-${r.id}`} onSelect={() => go(`/training/programs/${r.id}`)} className={item}>
                      <Layers aria-hidden />
                      {r.name}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
