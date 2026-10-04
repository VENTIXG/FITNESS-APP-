import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { Suspense } from "react";
import { PhotoGallery } from "@/components/progress/photos";
import { getT, getUserContext } from "@/server/context";
import { db } from "@/server/db";
import { progressPhotos } from "@/server/db/schema";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).photos.title };
}

export default async function PhotosPage() {
  const ctx = await getUserContext();
  const photos = await db
    .select({ id: progressPhotos.id, date: progressPhotos.date, pose: progressPhotos.pose, note: progressPhotos.note, width: progressPhotos.width, height: progressPhotos.height })
    .from(progressPhotos)
    .where(eq(progressPhotos.userId, ctx.userId))
    .orderBy(asc(progressPhotos.date));
  return (
    <Suspense>
      <PhotoGallery photos={photos} />
    </Suspense>
  );
}
