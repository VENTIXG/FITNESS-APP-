import { BackupForm, DeleteAllButton, DemoControls, ExportForm, RestoreForm } from "@/components/settings/data-manager";
import { SettingsCard } from "@/components/settings/forms";
import { SettingsFrame } from "@/components/settings/settings-page";
import { getUserContext } from "@/server/context";
import { db } from "@/server/db";
import { countDemoRows } from "@/server/services/demo";

export default async function DataSettingsPage() {
  const { t, userId } = await getUserContext();
  const demo = await countDemoRows(db, userId);
  return (
    <SettingsFrame section="data">
      <SettingsCard title={t.data.export}><ExportForm /></SettingsCard>
      <SettingsCard title={t.data.backup}><BackupForm /></SettingsCard>
      <SettingsCard title={t.data.restore}><RestoreForm /></SettingsCard>
      <SettingsCard title={t.data.demo}><DemoControls count={demo} /></SettingsCard>
      <SettingsCard title={t.settings.dangerZone}><DeleteAllButton /></SettingsCard>
      <SettingsCard title={t.data.print}><p className="text-[13px] text-fg-3">{t.data.printHint}</p></SettingsCard>
    </SettingsFrame>
  );
}
