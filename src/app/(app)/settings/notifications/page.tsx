import { NotificationPrefsForm, SettingsCard } from "@/components/settings/forms";
import { PushSettings } from "@/components/settings/push-settings";
import { SettingsFrame } from "@/components/settings/settings-page";
import { getUserContext } from "@/server/context";

export default async function NotificationSettingsPage() {
  const { t, prefs } = await getUserContext();
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || null;
  return (
    <SettingsFrame section="notifications">
      <SettingsCard title={t.notifications.pushStatus}>
        <PushSettings vapidPublicKey={vapidPublicKey} />
      </SettingsCard>
      <SettingsCard title={t.notifications.title}>
        <NotificationPrefsForm initial={prefs.notifications} />
      </SettingsCard>
    </SettingsFrame>
  );
}
