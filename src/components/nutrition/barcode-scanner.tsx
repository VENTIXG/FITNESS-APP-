"use client";

import * as React from "react";
import { ScanBarcode } from "lucide-react";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useRun } from "@/lib/client/run-action";
import { createFood } from "@/server/actions/nutrition";

type Off = { name: string; brand: string | null; barcode: string; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number; sugarG: number | null; sodiumMg: number | null; servingG: number | null };
type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/** Camera scanning uses the native BarcodeDetector where available; manual entry always works. */
export function BarcodeScanButton({ onFood }: { onFood: (foodId: string) => void }) {
  const t = useT();
  const ts = t.nutrition.scanner;
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button type="button" variant="secondary" size="icon" aria-label={t.nutrition.scanBarcode} onClick={() => setOpen(true)}>
        <ScanBarcode />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        {open && (
          <SheetContent title={ts.title}>
            <Scanner
              onFood={(id) => {
                setOpen(false);
                onFood(id);
              }}
            />
          </SheetContent>
        )}
      </Sheet>
    </>
  );
}

function Scanner({ onFood }: { onFood: (id: string) => void }) {
  const t = useT();
  const ts = t.nutrition.scanner;
  const { run, pending } = useRun();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = React.useState<"idle" | "on" | "denied" | "unsupported">("idle");
  const [code, setCode] = React.useState("");
  const [status, setStatus] = React.useState<string | null>(null);
  const [product, setProduct] = React.useState<Off | null>(null);
  const [busy, setBusy] = React.useState(false);
  const stop = React.useRef<() => void>(() => {});
  React.useEffect(() => () => stop.current(), []);

  const lookup = async (value: string) => {
    if (!/^\d{6,14}$/.test(value)) return;
    setBusy(true);
    setStatus(ts.lookingUp);
    setProduct(null);
    try {
      const res = await fetch(`/api/food/barcode/${value}`);
      const json = await res.json();
      if (json.found === "local") return onFood(json.foodId);
      if (json.found === "off") {
        setProduct(json.product);
        setStatus(ts.found);
      } else setStatus(json.online === "disabled" ? t.nutrition.onlineDisabled : json.online === "unavailable" ? t.nutrition.onlineUnavailable : ts.notFound);
    } catch {
      setStatus(t.nutrition.onlineUnavailable);
    } finally {
      setBusy(false);
    }
  };

  const startCamera = async () => {
    const Ctor = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) return setCamera("unsupported");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setCamera("on");
      const detector = new Ctor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
      let active = true;
      stop.current = () => {
        active = false;
        stream.getTracks().forEach((tr) => tr.stop());
      };
      const tick = async () => {
        if (!active) return;
        try {
          const found = await detector.detect(video);
          if (found[0]?.rawValue) {
            stop.current();
            setCamera("idle");
            setCode(found[0].rawValue);
            await lookup(found[0].rawValue);
            return;
          }
        } catch {
          // keep scanning
        }
        window.setTimeout(tick, 250);
      };
      tick();
    } catch {
      setCamera("denied");
    }
  };

  return (
    <div className="space-y-4">
      <div className={camera === "on" ? "overflow-hidden rounded-2xl bg-black" : "hidden"}>
        <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
      </div>
      {camera === "on" && <p className="text-center text-sm text-fg-3">{ts.hint}</p>}
      {camera === "idle" && (
        <Button type="button" variant="secondary" block onClick={startCamera}>
          <ScanBarcode aria-hidden />
          {ts.startCamera}
        </Button>
      )}
      {camera === "denied" && <p className="text-sm text-warn-text">{ts.cameraDenied}</p>}
      {camera === "unsupported" && <p className="text-sm text-fg-3">{ts.cameraUnavailable}</p>}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          lookup(code);
        }}
      >
        <Field label={ts.manual} htmlFor="bc-code" className="flex-1">
          <Input id="bc-code" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} maxLength={14} />
        </Field>
        <Button type="submit" variant="primary" loading={busy} disabled={!/^\d{6,14}$/.test(code)}>
          {ts.lookup}
        </Button>
      </form>
      {status && <p className="text-sm text-fg-2" role="status">{status}</p>}
      {product && (
        <div className="rounded-xl bg-surface-2 p-3">
          <div className="font-medium">{product.name}</div>
          <div className="text-xs text-fg-3">
            {product.brand} · {product.calories} kcal / 100 g · P {product.proteinG} · C {product.carbsG} · F {product.fatG}
          </div>
          <p className="mt-1 text-xs text-fg-3">{t.nutrition.fromOff}</p>
          <Button
            className="mt-3"
            variant="accent"
            size="sm"
            loading={pending}
            onClick={async () => {
              const servings = product.servingG && product.servingG > 0 ? [{ id: "serving", label: t.nutrition.servingSize.toLowerCase(), amount: product.servingG }] : [];
              const res = await run(() =>
                createFood({
                  name: product.name,
                  brand: product.brand,
                  barcode: product.barcode,
                  baseUnit: "g",
                  calories: product.calories,
                  proteinG: product.proteinG,
                  carbsG: product.carbsG,
                  fatG: product.fatG,
                  fiberG: product.fiberG,
                  sugarG: product.sugarG,
                  sodiumMg: product.sodiumMg,
                  servings,
                  defaultServingId: servings[0]?.id ?? null,
                  source: "openfoodfacts",
                  externalId: product.barcode,
                }),
              );
              if (res.ok) onFood(res.data.id);
            }}
          >
            {t.nutrition.foods.importFromOff}
          </Button>
        </div>
      )}
    </div>
  );
}
