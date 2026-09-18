import { PageHeader, StatTile, Table, EmptyState, ExportLink } from "@/components/ui";
import SetupNotice from "@/components/setup-notice";
import DayRangeFilter from "@/components/day-range-filter";
import { formatMoney, formatNumber, formatDate } from "@/lib/format";
import { getBulkOrders } from "@/lib/metrics";
import { BULK_ORDER_MIN_ITEMS } from "@/lib/config";

export const dynamic = "force-dynamic";

const RANGE_OPTIONS = [30, 90, 365, 0];

export default async function BulkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const params = await searchParams;
  const days = RANGE_OPTIONS.includes(Number(params.days)) ? Number(params.days) : 30;

  let data;
  try {
    data = await getBulkOrders(days);
  } catch (err) {
    return (
      <div>
        <PageHeader title="Bulk Orders" />
        <SetupNotice error={err instanceof Error ? err.message : String(err)} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Bulk Orders"
        description={`Orders with ${BULK_ORDER_MIN_ITEMS}+ items`}
        action={<ExportLink type="bulk-orders" days={days || undefined} />}
      />

      <div className="flex items-center justify-between mb-4">
        <div className="grid grid-cols-2 gap-4 flex-1 max-w-md">
          <StatTile label="Orders" value={formatNumber(data.count)} />
          <StatTile label="Value" value={formatMoney(data.totalValue)} />
        </div>
        <DayRangeFilter basePath="/operations/bulk-orders" activeDays={days} options={RANGE_OPTIONS} />
      </div>

      {data.orders.length === 0 ? (
        <EmptyState message="No bulk orders in this range." />
      ) : (
        <div className="bg-white border border-neutral-200 rounded-xl p-2">
          <Table columns={["Order", "Customer", "Items", "Total", "Date"]}>
            {data.orders.map((o) => (
              <tr key={o.id}>
                <td className="py-2 px-3">{o.order_number}</td>
                <td className="py-2 px-3">{o.customer_name ?? "—"}</td>
                <td className="py-2 px-3">{o.item_count}</td>
                <td className="py-2 px-3 font-medium">{formatMoney(Number(o.total))}</td>
                <td className="py-2 px-3 text-neutral-500">{formatDate(o.shopify_created_at)}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </div>
  );
}
