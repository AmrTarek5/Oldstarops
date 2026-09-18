import { PageHeader, EmptyState } from "@/components/ui";
import SetupNotice from "@/components/setup-notice";
import BarcodeReadinessTable from "@/components/barcode-readiness-table";
import { getVariantsMissingBarcodes } from "@/lib/ops";

export const dynamic = "force-dynamic";

export default async function BarcodeReadinessPage() {
  let rows;
  try {
    rows = await getVariantsMissingBarcodes();
  } catch (err) {
    return (
      <div>
        <PageHeader title="Barcode Readiness" />
        <SetupNotice error={err instanceof Error ? err.message : String(err)} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Barcode Readiness"
        description={`${rows.length} variants missing a barcode`}
      />
      {rows.length === 0 ? (
        <EmptyState message="Every variant has a barcode." />
      ) : (
        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <BarcodeReadinessTable rows={rows} />
        </div>
      )}
    </div>
  );
}
