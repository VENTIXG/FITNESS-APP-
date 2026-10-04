import { ActivityGoalsForm } from "@/components/settings/forms";
import { SettingsFrame } from "@/components/settings/settings-page";
import { Card } from "@/components/ui/card";
import { getUserContext } from "@/server/context";

export default async function ActivitySettingsPage() {
  const { prefs } = await getUserContext();
  return (
    <SettingsFrame section="activity">
      <Card>
        <ActivityGoalsForm initial={prefs.goals} />
      </Card>
    </SettingsFrame>
  );
}
