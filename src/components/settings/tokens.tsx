"use client";

import * as React from "react";
import { Check, Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { useFmt } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/input";
import { useRun } from "@/lib/client/run-action";
import { format } from "@/lib/i18n";
import { createApiToken, revokeApiToken } from "@/server/actions/tokens";

type Token = { id: string; name: string; prefix: string; lastUsedAt: string | null; createdAt: string };

export function TokenManager({ tokens }: { tokens: Token[] }) {
  const t = useT();
  const ti = t.integrations;
  const locale = useLocale();
  const fmt = useFmt();
  const { run, pending } = useRun();
  const { confirm, dialog } = useConfirm();
  const [name, setName] = React.useState("");
  const [created, setCreated] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="space-y-4">
      <form
        className="flex items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const res = await run(() => createApiToken({ name: name.trim() }));
          if (res.ok) {
            setCreated(res.data.token);
            setName("");
            setCopied(false);
          }
        }}
      >
        <Field label={ti.tokenName} htmlFor="tok-name" className="flex-1">
          <Input id="tok-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={ti.tokenNamePlaceholder} maxLength={60} />
        </Field>
        <Button type="submit" variant="secondary" loading={pending} disabled={!name.trim()}>
          <Plus aria-hidden />
          {ti.createToken}
        </Button>
      </form>
      {created && (
        <div className="rounded-xl border border-accent/50 bg-accent-soft p-3" role="status">
          <p className="mb-2 text-[13px] font-medium">{ti.tokenCreated}</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-surface px-2.5 py-2 font-mono text-xs">{created}</code>
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              aria-label={t.common.copy}
              onClick={async () => {
                await navigator.clipboard.writeText(created);
                setCopied(true);
              }}
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
        </div>
      )}
      {tokens.length ? (
        <ul className="divide-y divide-border">
          {tokens.map((tk) => (
            <li key={tk.id} className="flex items-center gap-3 py-2.5 text-sm">
              <KeyRound className="size-4 text-fg-3" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{tk.name}</div>
                <div className="text-xs text-fg-3">
                  <code className="font-mono">{tk.prefix}…</code> · {tk.lastUsedAt ? format(ti.lastUsed, { date: fmt.date(tk.lastUsedAt.slice(0, 10), "medium") }, locale) : ti.neverUsed}
                </div>
              </div>
              <Button
                variant="destructive-ghost"
                size="sm"
                onClick={async () => {
                  if (await confirm({ title: ti.revoke, description: tk.name, destructive: true, confirmLabel: ti.revoke })) await run(() => revokeApiToken({ id: tk.id }), { success: ti.revoked });
                }}
              >
                <Trash2 aria-hidden />
                {ti.revoke}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-fg-3">{ti.noTokens}</p>
      )}
      {dialog}
    </div>
  );
}
