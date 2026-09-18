import { PageHeader, StatTile, Table, Badge, EmptyState, ExportLink } from "@/components/ui";
import SetupNotice from "@/components/setup-notice";
import VipToggle from "@/components/vip-toggle";
import { formatMoney, formatNumber } from "@/lib/format";
import { getWhales } from "@/lib/metrics";
import { WHALE_SPEND_THRESHOLD } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function WhalesPage() {
  let data;
  try {
    data = await getWhales();
  } catch (err) {
    return (
      <div>
        <PageHeader title="Whales (VIP)" />
        <SetupNotice error={err instanceof Error ? err.message : String(err)} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Whales (VIP)"
        description={`Lifetime spend ≥ ${formatMoney(WHALE_SPEND_THRESHOLD)}, or manually flagged`}
        action={<ExportLink type="whales" />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatTile label="Whale count" value={formatNumber(data.count)} />
        <StatTile label="Combined revenue" value={formatMoney(data.totalRevenue)} tone="positive" />
      </div>

      {data.whales.length === 0 ? (
        <EmptyState message="No whales yet." />
      ) : (
        <div className="bg-white border border-neutral-200 rounded-xl p-2">
          <Table columns={["Customer", "Email", "Orders", "Lifetime spend", "Source", "Actions"]}>
            {data.whales.map((w) => (
              <tr key={w.email}>
                <td className="py-2 px-3">{w.name ?? "—"}</td>
                <td className="py-2 px-3 text-neutral-500">{w.email}</td>
                <td className="py-2 px-3">{formatNumber(w.orders)}</td>
                <td className="py-2 px-3 font-medium">{formatMoney(w.spend)}</td>
                <td className="py-2 px-3">
                  <Badge tone={w.isVip ? "info" : "default"}>{w.isVip ? "Manual VIP" : "Spend threshold"}</Badge>
                </td>
                <td className="py-2 px-3">
                  <VipToggle email={w.email} name={w.name} isVip={w.isVip} />
                </td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </div>
  );
}
