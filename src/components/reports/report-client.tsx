"use client";

import * as React from "react";
import { Printer } from "lucide-react";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { ChipToggle } from "@/components/ui/controls";
import { Field, Textarea } from "@/components/ui/input";
import { useRun } from "@/lib/client/run-action";
import { saveWeeklyReflection } from "@/server/actions/reports";

export function PrintButton() {
  const t = useT();
  return (
    <Button variant="secondary" size="sm" onClick={() => window.print()} className="print:hidden">
      <Printer aria-hidden />
      {t.reports.print}
    </Button>
  );
}

export function ReflectionForm({ weekStart, reflection, rating }: { weekStart: string; reflection: string | null; rating: number | null }) {
  const t = useT();
  const tr = t.reports;
  const { run, pending } = useRun();
  const [text, setText] = React.useState(reflection ?? "");
  const [r, setR] = React.useState<number | null>(rating);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        await run(() => saveWeeklyReflection({ weekStart, reflection: text.trim() || null, rating: r }), { success: tr.saved });
      }}
    >
      <Field label={tr.rating}>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((v) => (
            <ChipToggle key={v} selected={r === v} onClick={() => setR(r === v ? null : v)} className="min-w-11">
              {v}
            </ChipToggle>
          ))}
        </div>
      </Field>
      <Field label={tr.reflection} htmlFor="reflection">
        <Textarea id="reflection" rows={4} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder={tr.reflectionPlaceholder} />
      </Field>
      <Button type="submit" variant="secondary" loading={pending} className="print:hidden">
        {t.common.save}
      </Button>
    </form>
  );
}
