"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/server/db";
import { pushSubscriptions } from "@/server/db/schema";
import { isPushConfigured, sendPushToUser } from "@/server/push";
import { ActionError, createAction } from "./_lib";

const subSchema = z.object({
  endpoint: z.url().max(2000).refine((u) => u.startsWith("https://"), "https_only"),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

export const savePushSubscription = createAction(
  subSchema,
  async (input, ctx) => {
    if (!isPushConfigured()) throw new ActionError("not_configured");
    const ua = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
    await db
      .insert(pushSubscriptions)
      .values({ userId: ctx.userId, endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent: ua })
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId: ctx.userId, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent: ua } });
    return null;
  },
  { revalidate: false },
);

export const deletePushSubscription = createAction(
  z.object({ endpoint: z.string().max(2000) }),
  async (input, ctx) => {
    await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, ctx.userId), eq(pushSubscriptions.endpoint, input.endpoint)));
    return null;
  },
  { revalidate: false },
);

export const sendTestPush = createAction(
  z.object({}),
  async (_i, ctx) => {
    if (!isPushConfigured()) throw new ActionError("not_configured");
    const sent = await sendPushToUser(ctx.userId, { title: ctx.t.notifications.testSent, body: ctx.t.notifications.subscribed, url: "/", tag: "test" });
    if (!sent) throw new ActionError("not_found");
    return { sent };
  },
  { revalidate: false },
);
