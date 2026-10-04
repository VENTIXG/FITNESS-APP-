"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { PHOTO_POSES } from "@/lib/domain";
import { isoDate, optionalText, uuid } from "@/lib/validation";
import { db } from "@/server/db";
import { progressPhotos } from "@/server/db/schema";
import { ActionError, createAction } from "./_lib";

export const deletePhoto = createAction(z.object({ id: uuid }), async (input, ctx) => {
  await db.delete(progressPhotos).where(and(eq(progressPhotos.id, input.id), eq(progressPhotos.userId, ctx.userId)));
  return null;
});

export const updatePhoto = createAction(z.object({ id: uuid, date: isoDate, pose: z.enum(PHOTO_POSES), note: optionalText(500) }), async ({ id, ...input }, ctx) => {
  const res = await db.update(progressPhotos).set(input).where(and(eq(progressPhotos.id, id), eq(progressPhotos.userId, ctx.userId))).returning({ id: progressPhotos.id });
  if (!res.length) throw new ActionError("not_found");
  return null;
});
