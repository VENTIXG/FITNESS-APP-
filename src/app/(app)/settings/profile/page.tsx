import { ProfileForm } from "@/components/settings/forms";
import { SettingsFrame } from "@/components/settings/settings-page";
import { Card } from "@/components/ui/card";
import { getUserContext } from "@/server/context";

export default async function ProfileSettingsPage() {
  const { profile: p } = await getUserContext();
  return (
    <SettingsFrame section="profile">
      <Card>
        <ProfileForm
          initial={{ displayName: p.displayName, sex: p.sex, birthDate: p.birthDate, heightCm: p.heightCm, activityLevel: p.activityLevel, primaryGoal: p.primaryGoal, trainingDaysPerWeek: p.trainingDaysPerWeek }}
        />
      </Card>
    </SettingsFrame>
  );
}
