import { PageHeader, StatTile, Table, Badge, EmptyState, ExportLink } from "@/components/ui";
import SetupNotice from "@/components/setup-notice";
import { formatMoney } from "@/lib/format";
import { getInTransitStock } from "@/lib/ops";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "default" | "info" | "warning"> = {
  with_bosta: "info",
  out_for_delivery: "info",
  heading_back: "warning",
};

export default async function InTransitPage() {
  let data;
  try {
    data = await getInTransitStock();
  } catch (err) {
    return (
      <div>
        <PageHeader title="In-Transit Stock" />
        <SetupNotice error={err instanceof Error ? err.message : String(err)} />
      </div>
    );
  }

  const { rows, totals } = data;

  return (
    <div>
      <PageHeader
        title="In-Transit Stock"
        description="Inventory and cash value currently riding with Bosta"
        action={<ExportLink type="in-transit" />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatTile label="COD value in transit" value={formatMoney(totals.codAmount)} />
        <StatTile label="Stock value (cost)" value={formatMoney(totals.stockValueAtCost)} />
        <StatTile label="Stock value (retail)" value={formatMoney(totals.stockValueAtRetail)} />
      </div>

      {rows.length === 0 ? (
        <EmptyState message="Nothing in transit right now." />
      ) : (
        <div className="bg-white border border-neutral-200 rounded-xl p-2">
          <Table columns={["Tracking #", "Status", "Order", "Customer", "COD", "Value (cost)", "Value (retail)"]}>
            {rows.map((r) => (
              <tr key={r.deliveryId}>
                <td className="py-2 px-3 font-mono text-xs">{r.trackingNumber}</td>
                <td className="py-2 px-3">
                  <Badge tone={STATUS_TONE[r.status] ?? "default"}>{r.status.replace(/_/g, " ")}</Badge>
                </td>
                <td className="py-2 px-3">{r.orderNumber ?? "—"}</td>
                <td className="py-2 px-3">{r.customerName ?? "—"}</td>
                <td className="py-2 px-3">{formatMoney(r.codAmount)}</td>
                <td className="py-2 px-3">{formatMoney(r.stockValueAtCost)}</td>
                <td className="py-2 px-3">{formatMoney(r.stockValueAtRetail)}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </div>
  );
}
