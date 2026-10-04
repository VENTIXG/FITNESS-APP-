"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Camera, Columns2, ImagePlus, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useF, useT } from "@/components/providers/i18n-provider";
import { useFmt, useToday } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/controls";
import { EmptyState } from "@/components/ui/data-display";
import { Field, Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { compressImage } from "@/lib/client/image";
import { useRun } from "@/lib/client/run-action";
import { addDays, diffDays } from "@/lib/dates";
import { PHOTO_POSES, type PhotoPose } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { deletePhoto } from "@/server/actions/photos";

export type PhotoItem = { id: string; date: string; pose: PhotoPose; note: string | null; width: number; height: number };

export function PhotoUploader({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT();
  const today = useToday();
  const router = useRouter();
  const [date, setDate] = React.useState(today);
  const [items, setItems] = React.useState<{ file: File; url: string; pose: PhotoPose }[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => () => items.forEach((i) => URL.revokeObjectURL(i.url)), [items]);

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const next = [...files]
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 8)
      .map((file, i) => ({ file, url: URL.createObjectURL(file), pose: PHOTO_POSES[Math.min(i, 2)] as PhotoPose }));
    setItems((cur) => [...cur, ...next].slice(0, 8));
  };

  async function upload() {
    let ok = 0;
    for (const [i, item] of items.entries()) {
      try {
        setBusy(`${t.photos.compressing} ${i + 1}/${items.length}`);
        const full = await compressImage(item.file, 1600, 0.82);
        const thumb = await compressImage(item.file, 480, 0.75);
        setBusy(`${t.photos.uploading} ${i + 1}/${items.length}`);
        const fd = new FormData();
        fd.set("image", full.blob, "photo.jpg");
        fd.set("thumbnail", thumb.blob, "thumb.jpg");
        fd.set("date", date);
        fd.set("pose", item.pose);
        fd.set("width", String(full.width));
        fd.set("height", String(full.height));
        const res = await fetch("/api/photos", { method: "POST", body: fd });
        if (!res.ok) throw new Error(String(res.status));
        ok++;
      } catch (err) {
        toast.error(String(err).includes("413") ? t.errors.fileTooLarge : t.errors.uploadFailed);
      }
    }
    setBusy(null);
    if (ok) {
      toast.success(t.photos.uploaded);
      setItems([]);
      onOpenChange(false);
      router.refresh();
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <SheetContent
        title={t.photos.upload}
        description={t.photos.privacy}
        footer={
          <Button variant="primary" size="lg" block onClick={upload} disabled={!items.length || !!busy} loading={!!busy}>
            {busy ?? t.common.save}
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label={t.common.date} htmlFor="ph-date">
            <Input id="ph-date" type="date" value={date} max={addDays(today, 1)} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </Field>
          <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
          <Button variant="secondary" block size="lg" onClick={() => inputRef.current?.click()}>
            <ImagePlus aria-hidden />
            {t.photos.pickFiles}
          </Button>
          {items.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map((item, i) => (
                <li key={item.url} className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt="" className="aspect-[3/4] w-full rounded-xl object-cover" />
                  <div className="flex gap-1.5">
                    <Select value={item.pose} onChange={(e) => setItems((cur) => cur.map((x, j) => (j === i ? { ...x, pose: e.target.value as PhotoPose } : x)))} aria-label={t.photos.pose} className="flex-1 [&_select]:h-9 [&_select]:text-[13px]">
                      {PHOTO_POSES.map((p) => (
                        <option key={p} value={p}>
                          {t.enums.pose[p]}
                        </option>
                      ))}
                    </Select>
                    <Button variant="ghost" size="icon-sm" className="size-9" aria-label={t.common.remove} onClick={() => setItems((cur) => cur.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function PhotoGallery({ photos }: { photos: PhotoItem[] }) {
  const t = useT();
  const fmt = useFmt();
  const search = useSearchParams();
  const { run } = useRun();
  const { confirm, dialog } = useConfirm();
  const [uploadOpen, setUploadOpen] = React.useState(search.get("upload") === "1");
  const [viewing, setViewing] = React.useState<PhotoItem | null>(null);
  const byDate = new Map<string, PhotoItem[]>();
  for (const p of photos) byDate.set(p.date, [...(byDate.get(p.date) ?? []), p]);
  const dates = [...byDate.keys()].sort().reverse();

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[13px] text-fg-3">
          <Lock className="size-3.5" aria-hidden />
          {t.photos.privacy}
        </p>
        <div className="flex gap-2">
          {dates.length >= 2 && (
            <Button asChild variant="secondary" size="sm">
              <Link href="/progress/photos/compare">
                <Columns2 aria-hidden />
                {t.photos.compare}
              </Link>
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => setUploadOpen(true)}>
            <Camera aria-hidden />
            {t.photos.upload}
          </Button>
        </div>
      </div>
      {!photos.length ? (
        <div className="rounded-2xl border border-border bg-surface">
          <EmptyState
            icon={<Camera />}
            title={t.photos.emptyTitle}
            body={t.photos.emptyBody}
            action={
              <Button variant="primary" onClick={() => setUploadOpen(true)}>
                <ImagePlus aria-hidden />
                {t.photos.upload}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-6">
          {dates.map((date) => (
            <section key={date}>
              <h2 className="mb-2.5 text-sm font-medium text-fg-2">{fmt.date(date, "long")}</h2>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {byDate.get(date)!.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => setViewing(p)} className="group relative block w-full overflow-hidden rounded-xl bg-surface-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/photos/${p.id}?size=thumb`} alt={`${t.enums.pose[p.pose]} · ${fmt.date(p.date)}`} loading="lazy" className="aspect-[3/4] w-full object-cover transition group-hover:scale-[1.02]" />
                      <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">{t.enums.pose[p.pose]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <PhotoUploader open={uploadOpen} onOpenChange={setUploadOpen} />
      <Sheet open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        {viewing && (
          <SheetContent
            size="lg"
            title={`${t.enums.pose[viewing.pose]} · ${fmt.date(viewing.date, "medium")}`}
            headerAction={
              <Button
                variant="destructive-ghost"
                size="icon-sm"
                aria-label={t.common.delete}
                onClick={async () => {
                  if (await confirm({ title: t.common.delete, description: t.photos.deleteConfirm, destructive: true, confirmLabel: t.common.delete })) {
                    const res = await run(() => deletePhoto({ id: viewing.id }), { success: t.common.deleted });
                    if (res.ok) setViewing(null);
                  }
                }}
              >
                <Trash2 />
              </Button>
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/photos/${viewing.id}`} alt="" className="mx-auto max-h-[70dvh] w-auto rounded-xl object-contain" />
          </SheetContent>
        )}
      </Sheet>
      {dialog}
    </>
  );
}

export function PhotoCompare({
  photos,
  context,
}: {
  photos: PhotoItem[];
  context: Record<string, { weightKg: number | null; bodyFatPct: number | null }>;
}) {
  const t = useT();
  const f = useF();
  const fmt = useFmt();
  const dates = [...new Set(photos.map((p) => p.date))].sort();
  const [a, setA] = React.useState(dates[0] ?? "");
  const [b, setB] = React.useState(dates.at(-1) ?? "");
  const [pose, setPose] = React.useState<PhotoPose>("front");
  const find = (d: string) => photos.find((p) => p.date === d && p.pose === pose) ?? null;
  const side = (label: string, d: string, set: (v: string) => void) => {
    const photo = find(d);
    const c = context[d];
    return (
      <div className="min-w-0 flex-1">
        <Select value={d} onChange={(e) => set(e.target.value)} aria-label={label} className="mb-2">
          {dates.map((x) => (
            <option key={x} value={x}>
              {fmt.date(x, "medium")}
            </option>
          ))}
        </Select>
        <div className="overflow-hidden rounded-2xl bg-surface-2">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/photos/${photo.id}`} alt={`${label} · ${fmt.date(d)}`} className="aspect-[3/4] w-full object-cover" />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center p-4 text-center text-sm text-fg-3">{f(t.photos.noPhotoForPose, { pose: t.enums.pose[pose] })}</div>
          )}
        </div>
        <div className="mt-2 flex justify-between text-[13px]">
          <span className="font-medium text-fg-2">{label}</span>
          <span className="text-fg-3 tabular">
            {c?.weightKg != null ? fmt.weight(c.weightKg) : "—"}
            {c?.bodyFatPct != null ? ` · ${fmt.number(c.bodyFatPct, 1)}%` : ""}
          </span>
        </div>
      </div>
    );
  };
  if (dates.length < 2) return <p className="text-sm text-fg-3">{t.photos.selectTwo}</p>;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-surface-2 p-1">
          {PHOTO_POSES.map((p) => (
            <button key={p} type="button" onClick={() => setPose(p)} aria-pressed={pose === p} className={cn("h-8 rounded-lg px-3 text-[13px] font-medium", pose === p ? "bg-surface text-fg shadow-sm dark:bg-surface-3" : "text-fg-3")}>
              {t.enums.pose[p]}
            </button>
          ))}
        </div>
        {a && b && <span className="text-sm font-medium text-fg-2">{f(t.photos.daysBetween, { count: Math.abs(diffDays(b, a)) })}</span>}
      </div>
      <div className="flex gap-3 sm:gap-5">
        {side(t.photos.dateA, a, setA)}
        {side(t.photos.dateB, b, setB)}
      </div>
    </div>
  );
}
