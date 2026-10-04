"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { useRun } from "@/lib/client/run-action";
import { generateCoachSummary } from "@/server/actions/coach";

export function AiSummary({ configured }: { configured: boolean }) {
  const t = useT();
  const tc = t.coach;
  const { run, pending } = useRun();
  const [text, setText] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  if (!configured) return <p className="text-sm text-fg-3">{tc.aiNotConfigured}</p>;
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-fg-3">{tc.aiSummaryHint}</p>
      <Button
        variant="secondary"
        loading={pending}
        onClick={async () => {
          setError(null);
          const res = await run(() => generateCoachSummary({}), { silent: true });
          if (res.ok) setText(res.data.text);
          else setError(res.error === "not_configured" ? tc.aiNotConfigured : res.error === "rate_limited" ? t.auth.tooManyAttempts : tc.aiError);
        }}
      >
        <Sparkles aria-hidden />
        {pending ? tc.generating : tc.generate}
      </Button>
      {error && (
        <p className="text-sm text-critical-text" role="alert">
          {error}
        </p>
      )}
      {text && <div className="whitespace-pre-wrap rounded-2xl bg-surface-2 p-4 text-sm leading-relaxed text-fg-2" aria-live="polite">{text}</div>}
    </div>
  );
}
