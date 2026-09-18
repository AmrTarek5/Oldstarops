import { PageHeader, StatTile, Table, Badge, EmptyState, ExportLink } from "@/components/ui";
import SetupNotice from "@/components/setup-notice";
import DayRangeFilter from "@/components/day-range-filter";
import { formatMoney, formatDate } from "@/lib/format";
import { getShippingReconciliation } from "@/lib/ops";

export const dynamic = "force-dynamic";

const RANGE_OPTIONS = [30, 90, 365, 0];

export default async function ShippingReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const params = await searchParams;
  const days = RANGE_OPTIONS.includes(Number(params.days)) ? Number(params.days) : 30;

  let data;
  try {
    data = await getShippingReconciliation(days);
  } catch (err) {
    return (
      <div>
        <PageHeader title="Shipping Reconciliation" />
        <SetupNotice error={err instanceof Error ? err.message : String(err)} />
      </div>
    );
  }

  const { rows, totals } = data;

  return (
    <div>
      <PageHeader
        title="Shipping Reconciliation"
        description="Shipping charged to customers vs. actual Bosta cost, per delivered order"
        action={<ExportLink type="shipping-reconciliation" days={days || undefined} />}
      />

      <div className="flex items-center justify-between mb-4">
        <div className="grid grid-cols-3 gap-4 flex-1 max-w-xl">
          <StatTile label="Shipping charged" value={formatMoney(totals.shippingCharged)} />
          <StatTile label="Bosta cost" value={formatMoney(totals.bostaFee)} />
          <StatTile
            label="Net"
            value={formatMoney(totals.net)}
            tone={totals.net >= 0 ? "positive" : "negative"}
          />
        </div>
        <DayRangeFilter basePath="/operations/shipping-reconciliation" activeDays={days} options={RANGE_OPTIONS} />
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No delivered orders in this range." />
      ) : (
        <div className="bg-white border border-neutral-200 rounded-xl p-2">
          <Table columns={["Tracking #", "Order", "Delivered", "Charged", "Bosta cost", "Net"]}>
            {rows.map((r) => (
              <tr key={r.deliveryId}>
                <td className="py-2 px-3 font-mono text-xs">{r.trackingNumber}</td>
                <td className="py-2 px-3">{r.orderNumber ?? "—"}</td>
                <td className="py-2 px-3 text-neutral-500">{formatDate(r.deliveredAt)}</td>
                <td className="py-2 px-3">{formatMoney(r.shippingCharged)}</td>
                <td className="py-2 px-3 text-neutral-500">{formatMoney(r.bostaFee)}</td>
                <td className="py-2 px-3">
                  <Badge tone={r.net >= 0 ? "positive" : "negative"}>{formatMoney(r.net)}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </div>
  );
}
