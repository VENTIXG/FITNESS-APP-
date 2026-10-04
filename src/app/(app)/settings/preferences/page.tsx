import { PreferencesForm } from "@/components/settings/forms";
import { SettingsFrame } from "@/components/settings/settings-page";
import { Card } from "@/components/ui/card";
import { getUserContext } from "@/server/context";

export default async function PreferencesSettingsPage() {
  const { profile: p } = await getUserContext();
  return (
    <SettingsFrame section="preferences">
      <Card>
        <PreferencesForm initial={{ unitSystem: p.unitSystem, locale: p.locale, theme: p.theme, timezone: p.timezone, weekStartsOn: p.weekStartsOn }} />
      </Card>
    </SettingsFrame>
  );
}
