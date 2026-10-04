"use server";

import { z } from "zod";
import { db } from "@/server/db";
import { deleteUserData } from "@/server/services/backup";
import { countDemoRows, generateDemoData, removeDemoData } from "@/server/services/demo";
import { ActionError, createAction } from "./_lib";

export const loadDemoData = createAction(z.object({}), async (_i, ctx) => {
  await db.transaction(async (tx) => {
    if ((await countDemoRows(tx, ctx.userId)) > 0) throw new ActionError("duplicate");
    await generateDemoData(tx, ctx.userId, ctx.today);
  });
  return null;
});

export const removeDemo = createAction(z.object({}), async (_i, ctx) => {
  await db.transaction((tx) => removeDemoData(tx, ctx.userId));
  return null;
});

export const deleteAllData = createAction(z.object({ confirm: z.literal("DELETE") }), async (_i, ctx) => {
  await db.transaction((tx) => deleteUserData(tx, ctx.userId, { preferences: true }));
  return null;
});
