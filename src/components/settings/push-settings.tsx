"use client";

import * as React from "react";
import { BellOff, BellRing, Send } from "lucide-react";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { useRun } from "@/lib/client/run-action";
import { deletePushSubscription, savePushSubscription, sendTestPush } from "@/server/actions/push";

type State = "loading" | "unsupported" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function PushSettings({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const t = useT();
  const tn = t.notifications;
  const { run, pending } = useRun();
  const [state, setState] = React.useState<State>("loading");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (!cancelled) setState(sub ? "on" : "off");
    })().catch(() => !cancelled && setState("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!vapidPublicKey) return <p className="text-sm text-fg-3">{tn.pushNotConfigured}</p>;
  if (state === "loading") return <p className="text-sm text-fg-3">{t.common.loading}</p>;
  if (state === "unsupported") return <p className="text-sm text-fg-3">{tn.pushUnsupported}</p>;
  if (state === "denied") return <p className="text-sm text-fg-3">{tn.pushDenied}</p>;

  const subscribe = async () => {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setState(permission === "denied" ? "denied" : "off");
      return;
    }
    const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) });
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    const res = await run(() => savePushSubscription({ endpoint: json.endpoint, keys: json.keys }), { success: tn.subscribed });
    if (res.ok) setState("on");
    else await sub.unsubscribe();
  };

  const unsubscribe = async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await run(() => deletePushSubscription({ endpoint: sub.endpoint }), { silent: true });
      await sub.unsubscribe();
    }
    setState("off");
  };

  return (
    <div className="space-y-3">
      {state === "on" ? (
        <>
          <p className="flex items-center gap-2 text-sm text-good-text">
            <BellRing className="size-4" aria-hidden />
            {tn.subscribed}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" loading={pending} onClick={() => run(() => sendTestPush({}), { success: tn.testSent })}>
              <Send aria-hidden />
              {tn.test}
            </Button>
            <Button variant="ghost" size="sm" onClick={unsubscribe}>
              <BellOff aria-hidden />
              {tn.unsubscribe}
            </Button>
          </div>
        </>
      ) : (
        <Button variant="secondary" onClick={() => subscribe().catch(() => setState("unsupported"))}>
          <BellRing aria-hidden />
          {tn.subscribe}
        </Button>
      )}
    </div>
  );
}
