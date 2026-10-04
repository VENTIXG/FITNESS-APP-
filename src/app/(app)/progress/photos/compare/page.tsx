import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { PhotoCompare } from "@/components/progress/photos";
import { Card } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/page";
import { getT, getUserContext } from "@/server/context";
import { db } from "@/server/db";
import { progressPhotos } from "@/server/db/schema";
import { getWeights } from "@/server/queries/analysis";
import { getBodyComposition } from "@/server/queries/body";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).photos.compareTitle };
}

export default async function ComparePage() {
  const ctx = await getUserContext();
  const [photos, weights, comp] = await Promise.all([
    db
      .select({ id: progressPhotos.id, date: progressPhotos.date, pose: progressPhotos.pose, note: progressPhotos.note, width: progressPhotos.width, height: progressPhotos.height })
      .from(progressPhotos)
      .where(eq(progressPhotos.userId, ctx.userId))
      .orderBy(asc(progressPhotos.date)),
    getWeights(ctx.userId),
    getBodyComposition(ctx.userId),
  ]);
  // Weight / body fat closest to each photo date (within a week).
  const near = <T extends { date: string }>(rows: T[], date: string) => {
    let best: T | null = null;
    let bestD = 8;
    for (const r of rows) {
      const d = Math.abs(Date.parse(r.date) - Date.parse(date)) / 86_400_000;
      if (d < bestD) {
        bestD = d;
        best = r;
      }
    }
    return best;
  };
  const context: Record<string, { weightKg: number | null; bodyFatPct: number | null }> = {};
  for (const d of new Set(photos.map((p) => p.date))) {
    context[d] = { weightKg: near(weights, d)?.weightKg ?? null, bodyFatPct: near(comp, d)?.bodyFatPct ?? null };
  }
  return (
    <Card>
      <SectionTitle>{ctx.t.photos.compareTitle}</SectionTitle>
      <PhotoCompare photos={photos} context={context} />
    </Card>
  );
}
