import "@fontsource-variable/inter/opsz.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { AppProviders } from "@/components/providers/app-providers";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/config";
import type { ThemePreference } from "@/lib/domain";
import { getSessionUser } from "@/server/auth";
import { getLocale } from "@/server/context";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  // Private application: never index, never follow, never cache in search engines.
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false, email: false, address: false },
  referrer: "same-origin",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0c0e" },
    { media: "(prefers-color-scheme: light)", color: "#f5f5f3" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const locale = await getLocale();
  let theme: ThemePreference = "dark";
  try {
    theme = (await getSessionUser())?.profile?.theme ?? "dark";
  } catch {
    // Database unavailable: pages render their own setup message.
  }

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-dvh">
        <AppProviders locale={locale} theme={theme} nonce={nonce}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
