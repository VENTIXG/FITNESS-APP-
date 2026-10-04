"use client";

import { useEffect } from "react";

/** Registers the service worker in production (static asset caching + offline page). */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Non-fatal: the app works without a service worker.
    });
  }, []);
  return null;
}
