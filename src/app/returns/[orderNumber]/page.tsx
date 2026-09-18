import ReturnsPortalForm from "@/components/returns-portal-form";
import { getPortalSettings } from "@/lib/portal";

export default async function ReturnsOrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;

  let branding = { primaryColor: "#111827", policyText: null as string | null, logoUrl: null as string | null };
  try {
    const settings = await getPortalSettings();
    branding = {
      primaryColor: settings.primary_color,
      policyText: settings.policy_text,
      logoUrl: settings.logo_url,
    };
  } catch {
    // Fall back to defaults if Supabase isn't configured yet.
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {branding.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logoUrl} alt="Store logo" className="h-10 mx-auto mb-6" />
        )}
        <ReturnsPortalForm
          orderNumber={orderNumber}
          primaryColor={branding.primaryColor}
          policyText={branding.policyText}
        />
      </div>
    </div>
  );
}
