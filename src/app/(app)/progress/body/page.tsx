import type { Metadata } from "next";
import { Percent, Plus } from "lucide-react";
import { QuickAddButton } from "@/components/dashboard/islands";
import { BodyFatChart, MassCharts } from "@/components/progress/body-charts";
import { Card, CardHeader } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { EmptyState, Stat } from "@/components/ui/data-display";
import { format } from "@/lib/i18n";
import { deleteBodyComposition } from "@/server/actions/body";
import { getT, getUserContext } from "@/server/context";
import { getBodyComposition, getMeasurements, latestNavyEstimate } from "@/server/queries/body";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).body.composition };
}

export default async function BodyPage() {
  const ctx = await getUserContext();
  const { t, fmt } = ctx;
  const [rows, measurements] = await Promise.all([getBodyComposition(ctx.userId), getMeasurements(ctx.userId)]);
  const navy = latestNavyEstimate(measurements, ctx.profile);
  const latest = rows.at(-1);
  const first = rows[0];
  const add = (
    <QuickAddButton kind="bodyFat" variant="secondary" size="sm">
      <Plus aria-hidden />
      {t.common.add}
    </QuickAddButton>
  );

  if (!rows.length) {
    return (
      <div className="space-y-4">
        <Card>
          <EmptyState icon={<Percent />} title={t.body.emptyCompositionTitle} body={t.body.emptyCompositionBody} action={add} />
        </Card>
        {navy && <NavyCard navy={navy} />}
      </div>
    );
  }

  function NavyCard({ navy }: { navy: { date: string; pct: number } }) {
    return (
      <Card>
        <CardHeader title={t.body.navyEstimate} />
        <div className="text-2xl font-semibold">{fmt.number(navy.pct, 1)}%</div>
        <p className="mt-1 text-xs text-fg-3">
          {format(t.body.navyHint, { hips: ctx.profile.sex === "female" ? `, ${t.enums.site.hips.toLowerCase()}` : "" }, ctx.locale)} · {fmt.date(navy.date)}
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <Stat label={t.body.bodyFatPct} value={latest?.bodyFatPct != null ? `${fmt.number(latest.bodyFatPct, 1)}%` : "—"} sub={first && latest && first !== latest && first.bodyFatPct != null && latest.bodyFatPct != null ? <span className="text-fg-3">{fmt.number(latest.bodyFatPct - first.bodyFatPct, 1, { signed: true })} pp</span> : undefined} />
            <Stat label={t.body.leanMass} value={latest?.leanMassKg != null ? fmt.weight(latest.leanMassKg, { unit: false }) : "—"} unit={fmt.weightUnit} />
            <Stat label={t.body.fatMass} value={latest?.fatMassKg != null ? fmt.weight(latest.fatMassKg, { unit: false }) : "—"} unit={fmt.weightUnit} />
            <Stat label={t.body.navyEstimate} value={navy ? `${fmt.number(navy.pct, 1)}%` : "—"} />
          </div>
        </Card>
        <BodyFatChart rows={rows} />
        <MassCharts rows={rows} />
      </div>
      <Card>
        <CardHeader title={t.common.history} action={add} />
        <ul className="divide-y divide-border">
          {[...rows].reverse().map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{fmt.date(r.date, "weekdayShort")}</div>
                <div className="text-xs text-fg-3">{r.method ? t.enums.bodyFatMethod[r.method] : ""}</div>
              </div>
              <div className="text-right text-sm">
                <div className="font-semibold tabular">{r.bodyFatPct != null ? `${fmt.number(r.bodyFatPct, 1)}%` : "—"}</div>
                {r.leanMassKg != null && <div className="text-xs text-fg-3 tabular">{fmt.weight(r.leanMassKg)} {t.body.leanMass.toLowerCase()}</div>}
              </div>
              <DeleteButton id={r.id} action={deleteBodyComposition} description={fmt.date(r.date, "medium")} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
