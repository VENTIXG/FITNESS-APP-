import type { Metadata } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { format } from "@/lib/i18n";
import { groupBy } from "@/lib/utils";
import { getT, getUserContext } from "@/server/context";
import { getRecordsOverview } from "@/server/queries/training";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).training.recordsPage.title };
}

export default async function RecordsPage() {
  const ctx = await getUserContext();
  const { t, fmt, locale } = ctx;
  const tr = t.training.recordsPage;
  const { current, recent } = await getRecordsOverview(ctx.userId);
  const nameOf = (r: { name: string; nameEl: string | null }) => (locale === "el" && r.nameEl) || r.name;
  const val = (r: { type: string; value: number }) => (r.type === "e1rm" ? fmt.weight(r.value, { decimals: 1 }) : r.type === "reps" ? fmt.int(r.value) : fmt.load(r.value));

  if (!current.length) {
    return (
      <Card>
        <EmptyState icon={<Trophy />} title={tr.empty} body={tr.emptyBody} />
      </Card>
    );
  }
  const byExercise = [...groupBy(current, (r) => r.exerciseId).values()].sort((a, b) => {
    const ea = a.find((r) => r.type === "e1rm")?.value ?? 0;
    const eb = b.find((r) => r.type === "e1rm")?.value ?? 0;
    return eb - ea;
  });

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
      <Card className="p-0 lg:col-span-2">
        <div className="px-4 pt-4 sm:px-5">
          <CardHeader title={tr.title} />
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-border text-left text-xs text-fg-3">
              <th className="py-2 pl-4 font-medium sm:pl-5">{t.training.exercise.title}</th>
              <th className="whitespace-nowrap py-2 pl-3 text-right font-medium">e1RM</th>
              <th className="whitespace-nowrap py-2 pr-4 pl-3 text-right font-medium sm:pr-5">{t.training.exercise.maxWeight}</th>
            </tr>
          </thead>
          <tbody>
            {byExercise.map((list) => {
              const e = list.find((r) => r.type === "e1rm");
              const w = list.find((r) => r.type === "weight");
              const reps = list.find((r) => r.type === "reps");
              return (
                <tr key={list[0].exerciseId} className="border-b border-border last:border-0">
                  <td className="py-2.5 pl-4 sm:pl-5">
                    <Link href={`/training/exercises/${list[0].exerciseId}`} className="font-medium hover:text-accent">
                      {nameOf(list[0])}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap py-2.5 pl-3 text-right tabular">{e ? val(e) : reps ? `${val(reps)} ${t.training.reps.toLowerCase()}` : "—"}</td>
                  <td className="whitespace-nowrap py-2.5 pr-4 pl-3 text-right font-semibold tabular sm:pr-5">{w ? val(w) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Card>
        <CardHeader title={t.training.workout.newPrs} icon={<Trophy />} />
        <ul className="divide-y divide-border">
          {recent.map((r, i) => (
            <li key={i} className="py-2.5 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <Link href={`/training/workout/${r.workoutId}`} className="truncate font-medium hover:text-accent">
                  {nameOf(r)}
                </Link>
                <span className="shrink-0 font-semibold tabular">{val(r)}</span>
              </div>
              <div className="flex justify-between gap-2 text-xs text-fg-3">
                <span>
                  {t.enums.prType[r.type]} · {fmt.date(r.date, "dayMonth")}
                </span>
                {r.previousValue != null && <span className="tabular">{format(tr.previous, { value: val({ type: r.type, value: r.previousValue }) }, locale)}</span>}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
