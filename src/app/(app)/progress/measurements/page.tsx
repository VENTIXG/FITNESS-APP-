import type { Metadata } from "next";
import { Plus, Ruler } from "lucide-react";
import { QuickAddButton } from "@/components/dashboard/islands";
import { MeasurementChart } from "@/components/progress/body-charts";
import { Card, CardHeader } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { EmptyState } from "@/components/ui/data-display";
import { MEASUREMENT_SITES, type MeasurementSite } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { deleteMeasurements } from "@/server/actions/body";
import { getT, getUserContext } from "@/server/context";
import { getMeasurements } from "@/server/queries/body";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).body.measurements };
}

const COL: Record<MeasurementSite, string> = {
  waist: "waistCm",
  chest: "chestCm",
  neck: "neckCm",
  shoulders: "shouldersCm",
  leftArm: "leftArmCm",
  rightArm: "rightArmCm",
  hips: "hipsCm",
  leftThigh: "leftThighCm",
  rightThigh: "rightThighCm",
  calf: "calfCm",
};

export default async function MeasurementsPage() {
  const ctx = await getUserContext();
  const { t, fmt } = ctx;
  const rows = await getMeasurements(ctx.userId);
  const add = (
    <QuickAddButton kind="measurement" variant="secondary" size="sm">
      <Plus aria-hidden />
      {t.common.add}
    </QuickAddButton>
  );
  if (!rows.length) {
    return (
      <Card>
        <EmptyState icon={<Ruler />} title={t.body.emptyMeasurementsTitle} body={t.body.emptyMeasurementsBody} action={add} />
      </Card>
    );
  }
  const value = (r: (typeof rows)[number], s: MeasurementSite) => (r as unknown as Record<string, number | null>)[COL[s]];
  const firstFor = (s: MeasurementSite) => rows.find((r) => value(r, s) != null);
  const lastFor = (s: MeasurementSite) => [...rows].reverse().find((r) => value(r, s) != null);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <MeasurementChart rows={rows as unknown as Record<string, unknown>[]} />
        <Card>
          <CardHeader title={t.body.latest} action={add} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-fg-3">
                <tr>
                  <th className="py-2 font-medium">{t.body.site}</th>
                  <th className="py-2 text-right font-medium">{t.body.latest}</th>
                  <th className="py-2 text-right font-medium">{t.body.changeSinceFirst}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {MEASUREMENT_SITES.map((s) => {
                  const last = lastFor(s);
                  const first = firstFor(s);
                  const lv = last ? value(last, s) : null;
                  const fv = first ? value(first, s) : null;
                  const diff = lv != null && fv != null && first !== last ? lv - fv : null;
                  return (
                    <tr key={s}>
                      <td className="py-2.5 text-fg-2">{t.enums.site[s]}</td>
                      <td className="py-2.5 text-right font-semibold tabular">{lv != null ? fmt.length(lv) : "—"}</td>
                      <td className={cn("py-2.5 text-right tabular", diff == null ? "text-fg-3" : "text-fg-2")}>{diff != null ? fmt.length(diff, { signed: true }) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <Card>
        <CardHeader title={t.common.history} />
        <ul className="divide-y divide-border">
          {[...rows].reverse().map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{fmt.date(r.date, "weekdayShort")}</div>
                <div className="truncate text-xs text-fg-3">
                  {MEASUREMENT_SITES.filter((s) => value(r, s) != null)
                    .slice(0, 3)
                    .map((s) => `${t.enums.site[s]} ${fmt.length(value(r, s)!)}`)
                    .join(" · ")}
                </div>
              </div>
              <DeleteButton id={r.id} action={deleteMeasurements} description={fmt.date(r.date, "medium")} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
