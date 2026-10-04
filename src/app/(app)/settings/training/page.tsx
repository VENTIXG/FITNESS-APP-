import { TrainingPrefsForm } from "@/components/settings/forms";
import { SettingsFrame } from "@/components/settings/settings-page";
import { Card } from "@/components/ui/card";
import { getUserContext } from "@/server/context";

export default async function TrainingSettingsPage() {
  const { prefs } = await getUserContext();
  return (
    <SettingsFrame section="training">
      <Card>
        <TrainingPrefsForm initial={prefs.training} />
      </Card>
    </SettingsFrame>
  );
}
