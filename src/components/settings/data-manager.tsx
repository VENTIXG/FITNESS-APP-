"use client";

import * as React from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { useLocale, useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Segmented, Select, SwitchRow } from "@/components/ui/controls";
import { Field } from "@/components/ui/input";
import { APP_NAME } from "@/lib/config";
import { useRun } from "@/lib/client/run-action";
import { format } from "@/lib/i18n";
import { deleteAllData, loadDemoData, removeDemo } from "@/server/actions/data";

const CATS = ["weight", "nutrition", "workouts", "measurements", "cardio", "all"] as const;

export function ExportForm() {
  const t = useT();
  const td = t.data;
  const [cat, setCat] = React.useState<(typeof CATS)[number]>("weight");
  const [fmt, setFmt] = React.useState<"csv" | "xlsx" | "json">("csv");
  const f = cat === "all" && fmt === "csv" ? "xlsx" : fmt;
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-fg-3">{td.exportHint}</p>
      <Field label={td.exportCategory} htmlFor="ex-cat">
        <Select id="ex-cat" value={cat} onChange={(e) => setCat(e.target.value as typeof cat)}>
          {CATS.map((c) => (
            <option key={c} value={c}>{td.categories[c]}</option>
          ))}
        </Select>
      </Field>
      <Field label={td.exportFormat}>
        <Segmented block value={f} onChange={setFmt} ariaLabel={td.exportFormat} options={(["csv", "xlsx", "json"] as const).filter((x) => !(cat === "all" && x === "csv")).map((x) => ({ value: x, label: td.formats[x] }))} />
      </Field>
      <Button asChild variant="secondary">
        <a href={`/api/export?category=${cat}&format=${f}`} download>
          <Download aria-hidden />
          {td.download}
        </a>
      </Button>
    </div>
  );
}

export function BackupForm() {
  const td = useT().data;
  const [photos, setPhotos] = React.useState(false);
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-fg-3">{td.backupHint}</p>
      <SwitchRow label={td.includePhotos} checked={photos} onCheckedChange={setPhotos} />
      <Button asChild variant="secondary">
        <a href={`/api/backup${photos ? "?photos=1" : ""}`} download>
          <Download aria-hidden />
          {td.downloadBackup}
        </a>
      </Button>
    </div>
  );
}

type Parsed = { data: unknown; exportedAt: string; counts: [string, number][] };

export function RestoreForm() {
  const t = useT();
  const td = t.data;
  const locale = useLocale();
  const { confirm, dialog } = useConfirm();
  const [parsed, setParsed] = React.useState<Parsed | null>(null);
  const [mode, setMode] = React.useState<"merge" | "replace">("merge");
  const [busy, setBusy] = React.useState(false);
  const onFile = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (data?.app !== "forge" || typeof data.tables !== "object") throw new Error();
      const counts = Object.entries(data.tables as Record<string, unknown[]>).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0] as [string, number]).filter(([, n]) => n > 0);
      setParsed({ data, exportedAt: data.exportedAt, counts });
    } catch {
      setParsed(null);
      toast.error(format(td.invalidBackup, { app: APP_NAME }, locale));
    }
  };
  const restore = async () => {
    if (!parsed) return;
    const ok = await confirm(
      mode === "replace"
        ? { title: td.restore, description: td.replaceWarning, destructive: true, confirmWord: td.confirmWord, confirmWordLabel: format(td.typeToConfirm, { word: td.confirmWord }, locale), confirmLabel: td.restoreButton }
        : { title: td.restore, description: td.modeMerge, confirmLabel: td.restoreButton },
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/restore?mode=${mode}${mode === "replace" ? "&confirm=REPLACE" : ""}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(format(td.restored, { inserted: json.inserted, skipped: json.skipped }, locale));
      setParsed(null);
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-fg-3">{td.restoreHint}</p>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium hover:bg-surface-3">
        <Upload className="size-4" aria-hidden />
        {td.chooseFile}
        <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
      {parsed && (
        <div className="space-y-3 rounded-xl bg-surface-2 p-3">
          <div className="text-sm font-semibold">{td.preview}</div>
          <div className="text-xs text-fg-3">{format(td.createdAt, { date: parsed.exportedAt.slice(0, 10) }, locale)}</div>
          <ul className="grid grid-cols-2 gap-x-4 text-xs text-fg-2 tabular">
            {parsed.counts.map(([k, n]) => (
              <li key={k} className="flex justify-between"><span>{k}</span><span>{n}</span></li>
            ))}
          </ul>
          <div className="space-y-1.5 text-sm">
            {(["merge", "replace"] as const).map((m) => (
              <label key={m} className="flex items-start gap-2">
                <input type="radio" name="restore-mode" checked={mode === m} onChange={() => setMode(m)} className="mt-1 accent-[var(--accent)]" />
                {m === "merge" ? td.modeMerge : td.modeReplace}
              </label>
            ))}
          </div>
          <Button variant={mode === "replace" ? "destructive" : "primary"} loading={busy} onClick={restore}>
            {busy ? td.restoring : td.restoreButton}
          </Button>
        </div>
      )}
      {dialog}
    </div>
  );
}

export function DemoControls({ count }: { count: number }) {
  const t = useT();
  const td = t.data;
  const locale = useLocale();
  const { run, pending } = useRun();
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-fg-3">{td.demoHint}</p>
      <p className="text-sm">{count ? format(td.demoPresent, { count }, locale) : td.noDemo}</p>
      {count ? (
        <Button variant="secondary" loading={pending} onClick={() => run(() => removeDemo({}), { success: td.demoRemoved })}>{td.removeDemo}</Button>
      ) : (
        <Button variant="secondary" loading={pending} onClick={() => run(() => loadDemoData({}), { success: td.demoLoaded })}>{pending ? td.loadingDemo : td.loadDemo}</Button>
      )}
    </div>
  );
}

export function DeleteAllButton() {
  const t = useT();
  const td = t.data;
  const locale = useLocale();
  const { run } = useRun();
  const { confirm, dialog } = useConfirm();
  return (
    <>
      <p className="mb-3 text-[13px] text-fg-3">{td.deleteAllHint}</p>
      <Button
        variant="destructive"
        onClick={async () => {
          if (await confirm({ title: td.deleteAll, description: format(td.deleteAllConfirm, { word: td.deleteWord }, locale), destructive: true, confirmWord: td.deleteWord, confirmWordLabel: format(td.typeToConfirm, { word: td.deleteWord }, locale), confirmLabel: td.deleteAll }))
            await run(() => deleteAllData({ confirm: "DELETE" }), { success: td.deletedAll });
        }}
      >
        {td.deleteAll}
      </Button>
      {dialog}
    </>
  );
}
