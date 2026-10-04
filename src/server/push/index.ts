import "server-only";
import { eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { APP_NAME } from "@/lib/config";
import { db } from "@/server/db";
import { pushSubscriptions } from "@/server/db/schema";

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

let configured: boolean | null = null;

/** Web push needs a VAPID key pair (see `pnpm vapid:generate`). */
export function isPushConfigured() {
  if (configured != null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  const subject = process.env.VAPID_SUBJECT || (process.env.APP_URL?.startsWith("https://") ? process.env.APP_URL : "mailto:admin@localhost");
  webpush.setVapidDetails(subject, pub, priv);
  return (configured = true);
}

/** Sends to every device of a user. Expired subscriptions (404/410) are removed. Returns the number delivered. */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!isPushConfigured()) return 0;
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  const gone: string[] = [];
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ ...payload, title: payload.title || APP_NAME }),
          { TTL: 60 * 60 * 6, urgency: "normal" },
        );
        sent++;
        await db.update(pushSubscriptions).set({ lastSuccessAt: new Date() }).where(eq(pushSubscriptions.id, s.id));
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s.id);
        else console.error("push failed", status);
      }
    }),
  );
  if (gone.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
  return sent;
}
