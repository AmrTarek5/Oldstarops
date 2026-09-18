import { PageHeader, EmptyState, ExportLink } from "@/components/ui";
import SetupNotice from "@/components/setup-notice";
import FailedDeliveriesTable from "@/components/failed-deliveries-table";
import { getFailedDeliveries } from "@/lib/ops";

export const dynamic = "force-dynamic";

export default async function FailedDeliveriesPage() {
  let rows;
  try {
    rows = await getFailedDeliveries();
  } catch (err) {
    return (
      <div>
        <PageHeader title="Failed Deliveries" />
        <SetupNotice error={err instanceof Error ? err.message : String(err)} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Failed Deliveries"
        description={`${rows.length} failed ${rows.length === 1 ? "delivery" : "deliveries"} awaiting processing`}
        action={<ExportLink type="failed-deliveries" />}
      />
      {rows.length === 0 ? (
        <EmptyState message="No unresolved failed deliveries." />
      ) : (
        <div className="bg-white border border-neutral-200 rounded-xl p-2">
          <FailedDeliveriesTable rows={rows} />
        </div>
      )}
    </div>
  );
}
