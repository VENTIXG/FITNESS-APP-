import { DashboardPrefsForm } from "@/components/settings/forms";
import { SettingsFrame } from "@/components/settings/settings-page";
import { Card } from "@/components/ui/card";
import { resolveDashboardOrder } from "@/lib/preferences";
import { getUserContext } from "@/server/context";

export default async function DashboardSettingsPage() {
  const { prefs } = await getUserContext();
  return (
    <SettingsFrame section="dashboard">
      <Card>
        <DashboardPrefsForm order={resolveDashboardOrder(prefs.dashboard)} hidden={prefs.dashboard.hidden} scoring={prefs.scoring} />
      </Card>
    </SettingsFrame>
  );
}
