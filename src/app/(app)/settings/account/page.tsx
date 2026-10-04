import { LogOut, Monitor } from "lucide-react";
import { PasswordForm, SettingsCard, SignOutOthersButton } from "@/components/settings/forms";
import { SettingsFrame } from "@/components/settings/settings-page";
import { Button } from "@/components/ui/button";
import { signOut } from "@/server/actions/auth";
import { getSessionUser, listSessions } from "@/server/auth/session";
import { getUserContext } from "@/server/context";

function deviceLabel(ua: string | null) {
  if (!ua) return "—";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  return [browser, os].filter(Boolean).join(" · ") || ua.slice(0, 60);
}

export default async function AccountSettingsPage() {
  const ctx = await getUserContext();
  const { t, fmt } = ctx;
  const [sessions, current] = await Promise.all([listSessions(ctx.userId), getSessionUser()]);
  return (
    <SettingsFrame section="account">
      <SettingsCard title={t.settings.email}>
        <p className="text-sm">{ctx.email}</p>
      </SettingsCard>
      <SettingsCard title={t.settings.changePasswordSection}>
        <PasswordForm />
      </SettingsCard>
      <SettingsCard title={t.settings.sessionsSection}>
        <ul className="mb-4 divide-y divide-border">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
              <Monitor className="size-4 text-fg-3" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{deviceLabel(s.userAgent)}</span>
              {s.id === current?.sessionId ? (
                <span className="text-xs font-medium text-good-text">{t.common.current}</span>
              ) : (
                <span className="text-xs text-fg-3">{fmt.time(s.lastSeenAt, ctx.timezone)} · {fmt.date(s.lastSeenAt.toISOString().slice(0, 10), "dayMonth")}</span>
              )}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          {sessions.length > 1 && <SignOutOthersButton />}
          <form action={signOut}>
            <Button type="submit" variant="destructive-ghost">
              <LogOut aria-hidden />
              {t.nav.signOut}
            </Button>
          </form>
        </div>
      </SettingsCard>
    </SettingsFrame>
  );
}
