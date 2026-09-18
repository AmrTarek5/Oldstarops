import { PageHeader } from "@/components/ui";
import SetupNotice from "@/components/setup-notice";
import ReturnScannerClient from "@/components/return-scanner-client";
import { getFailedDeliveryCount } from "@/lib/ops";

export const dynamic = "force-dynamic";

export default async function ReturnScannerPage() {
  let failedCount = 0;
  let error: string | null = null;
  try {
    failedCount = await getFailedDeliveryCount();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <div>
      <PageHeader
        title="Return Scanner"
        description="Scan a Bosta QR or tracking number to process failed deliveries and accepted returns"
      />
      {error ? <SetupNotice error={error} /> : <ReturnScannerClient initialFailedCount={failedCount} />}
    </div>
  );
}
