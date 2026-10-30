import { PageHeader } from "@/components/ui";
import SetupNotice from "@/components/setup-notice";
import PortalSettingsForm from "@/components/portal-settings-form";
import { getPortalSettings } from "@/lib/portal";
import type { PortalSettingsRow } from "@/lib/types";
import { errorMessage } from "@/lib/error-message";

export const dynamic = "force-dynamic";

export default async function PortalSettingsPage() {
  let settings: PortalSettingsRow | null = null;
  let error: string | null = null;
  try {
    settings = await getPortalSettings();
  } catch (err) {
    error = errorMessage(err);
  }

  return (
    <div>
      <PageHeader title="Portal Branding" description="Customize the public returns portal" />
      {error || !settings ? <SetupNotice error={error ?? "Unknown error"} /> : <PortalSettingsForm settings={settings} />}
    </div>
  );
}
