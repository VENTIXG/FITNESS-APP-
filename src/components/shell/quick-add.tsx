"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Camera, Dumbbell, Footprints, GlassWater, HeartPulse, Moon, NotebookPen, Percent, Ruler, UtensilsCrossed, Weight } from "lucide-react";
import { BodyCompositionForm, CardioForm, MeasurementsForm } from "@/components/forms/body-forms";
import { NoteForm, SleepForm, StepsForm, WaterQuickAdd } from "@/components/forms/lifestyle-forms";
import { WeightForm } from "@/components/forms/weight-form";
import { useT } from "@/components/providers/i18n-provider";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { getQuickAddDefaults } from "@/server/actions/quick";

export type QuickAddKind = "weight" | "water" | "steps" | "cardio" | "sleep" | "measurement" | "bodyFat" | "note";
export type QuickAddHandle = { open: () => void; openForm: (kind: QuickAddKind) => void };

type Defaults = { lastWeightKg: number | null; waterMl: number; manualSteps: number | null };

export function QuickAdd({ ref }: { ref?: React.Ref<QuickAddHandle> }) {
  const t = useT();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [form, setForm] = React.useState<QuickAddKind | null>(null);
  const [defaults, setDefaults] = React.useState<Defaults | null>(null);

  const loadDefaults = React.useCallback(() => {
    void getQuickAddDefaults({}).then((res) => res.ok && setDefaults(res.data));
  }, []);

  const openForm = React.useCallback(
    (kind: QuickAddKind) => {
      setMenuOpen(false);
      loadDefaults();
      setForm(kind);
    },
    [loadDefaults],
  );

  React.useImperativeHandle(ref, () => ({ open: () => setMenuOpen(true), openForm }), [openForm]);

  const go = (href: string) => {
    setMenuOpen(false);
    router.push(href);
  };

  const items: { key: string; label: string; icon: React.ReactNode; onSelect: () => void; tint: string }[] = [
    { key: "weight", label: t.quickAdd.weight, icon: <Weight />, onSelect: () => openForm("weight"), tint: "var(--series-1)" },
    { key: "food", label: t.quickAdd.food, icon: <UtensilsCrossed />, onSelect: () => go("/nutrition?add=1"), tint: "var(--series-2)" },
    { key: "workout", label: t.quickAdd.workout, icon: <Dumbbell />, onSelect: () => go("/training"), tint: "var(--series-3)" },
    { key: "cardio", label: t.quickAdd.cardio, icon: <HeartPulse />, onSelect: () => openForm("cardio"), tint: "var(--series-4)" },
    { key: "water", label: t.quickAdd.water, icon: <GlassWater />, onSelect: () => openForm("water"), tint: "var(--series-3)" },
    { key: "steps", label: t.quickAdd.steps, icon: <Footprints />, onSelect: () => openForm("steps"), tint: "var(--series-5)" },
    { key: "measurement", label: t.quickAdd.measurement, icon: <Ruler />, onSelect: () => openForm("measurement"), tint: "var(--series-7)" },
    { key: "bodyFat", label: t.quickAdd.bodyFat, icon: <Percent />, onSelect: () => openForm("bodyFat"), tint: "var(--series-7)" },
    { key: "photo", label: t.quickAdd.photo, icon: <Camera />, onSelect: () => go("/progress/photos?upload=1"), tint: "var(--series-6)" },
    { key: "sleep", label: t.quickAdd.sleep, icon: <Moon />, onSelect: () => openForm("sleep"), tint: "var(--series-7)" },
    { key: "note", label: t.quickAdd.note, icon: <NotebookPen />, onSelect: () => openForm("note"), tint: "var(--fg-3)" },
  ];

  const close = () => setForm(null);
  const titles: Record<QuickAddKind, string> = {
    weight: t.weight.logTitle,
    water: t.water.add,
    steps: t.steps.title,
    cardio: t.cardio.logTitle,
    sleep: t.sleep.log,
    measurement: t.body.logMeasurements,
    bodyFat: t.body.logComposition,
    note: t.notes.title,
  };

  return (
    <>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent title={t.quickAdd.title} size="md">
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={item.onSelect}
                className="flex aspect-[1.05] flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-surface-2/60 p-2 text-center text-[13px] font-medium text-fg transition hover:border-border-strong hover:bg-surface-2 active:scale-[0.97]"
              >
                <span
                  className="flex size-10 items-center justify-center rounded-xl [&_svg]:size-5"
                  style={{ background: `color-mix(in oklab, ${item.tint} 16%, transparent)`, color: item.tint }}
                >
                  {item.icon}
                </span>
                <span className="leading-tight">{item.label}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={form != null} onOpenChange={(o) => !o && close()}>
        {form && (
          <SheetContent title={titles[form]} size={form === "measurement" || form === "cardio" ? "lg" : "md"}>
            {form === "weight" &&
              (defaults ? <WeightForm lastWeightKg={defaults.lastWeightKg} onDone={close} /> : <FormSkeleton />)}
            {form === "water" && (defaults ? <WaterQuickAdd totalMl={defaults.waterMl} onAdded={loadDefaults} /> : <FormSkeleton />)}
            {form === "steps" && (defaults ? <StepsForm currentManual={defaults.manualSteps} onDone={close} /> : <FormSkeleton />)}
            {form === "cardio" && <CardioForm onDone={close} />}
            {form === "sleep" && <SleepForm onDone={close} />}
            {form === "measurement" && <MeasurementsForm onDone={close} />}
            {form === "bodyFat" && (defaults ? <BodyCompositionForm onDone={close} latestWeightKg={defaults.lastWeightKg} /> : <FormSkeleton />)}
            {form === "note" && <NoteForm onDone={close} />}
          </SheetContent>
        )}
      </Sheet>
    </>
  );
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      <div className="h-14 animate-pulse rounded-xl bg-surface-2" />
      <div className="h-11 animate-pulse rounded-xl bg-surface-2" />
      <div className="h-12 animate-pulse rounded-2xl bg-surface-2" />
    </div>
  );
}
