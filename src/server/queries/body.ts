import "server-only";
import { asc, eq } from "drizzle-orm";
import { navyBodyFat, resolveComposition } from "@/lib/calc/body";
import { db } from "@/server/db";
import { bodyCompositionEntries, bodyMeasurements, weightEntries } from "@/server/db/schema";

/** Body composition with fat/lean mass resolved from the nearest weigh-in (±3 days). */
export async function getBodyComposition(userId: string) {
  const [rows, weights] = await Promise.all([
    db.select().from(bodyCompositionEntries).where(eq(bodyCompositionEntries.userId, userId)).orderBy(asc(bodyCompositionEntries.date)),
    db.select({ date: weightEntries.date, weightKg: weightEntries.weightKg }).from(weightEntries).where(eq(weightEntries.userId, userId)).orderBy(asc(weightEntries.date)),
  ]);
  const nearestWeight = (date: string) => {
    let best: { d: number; w: number } | null = null;
    const t = Date.parse(date);
    for (const w of weights) {
      const d = Math.abs(Date.parse(w.date) - t) / 86_400_000;
      if (d <= 3 && (!best || d < best.d)) best = { d, w: w.weightKg };
    }
    return best?.w ?? null;
  };
  return rows.map((r) => {
    const weightKg = nearestWeight(r.date);
    return { ...r, weightKg, ...resolveComposition({ weightKg, bodyFatPct: r.bodyFatPct, fatMassKg: r.fatMassKg, leanMassKg: r.leanMassKg }) };
  });
}

export async function getMeasurements(userId: string) {
  return db.select().from(bodyMeasurements).where(eq(bodyMeasurements.userId, userId)).orderBy(asc(bodyMeasurements.date));
}

export function latestNavyEstimate(
  rows: Awaited<ReturnType<typeof getMeasurements>>,
  profile: { sex: "male" | "female" | null; heightCm: number | null },
) {
  if (!profile.sex || !profile.heightCm) return null;
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (r.neckCm && r.waistCm) {
      const pct = navyBodyFat({ sex: profile.sex, heightCm: profile.heightCm, neckCm: r.neckCm, waistCm: r.waistCm, hipsCm: r.hipsCm });
      if (pct != null) return { date: r.date, pct };
    }
  }
  return null;
}
