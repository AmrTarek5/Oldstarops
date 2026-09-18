import { PageHeader, Card, StatTile, Badge } from "@/components/ui";
import DeliveryFunnelChart from "@/components/charts/delivery-funnel-chart";
import ReturnReasonsChart from "@/components/charts/return-reasons-chart";
import DayRangeFilter from "@/components/day-range-filter";
import SetupNotice from "@/components/setup-notice";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import {
  getBulkOrders,
  getCashFlow,
  getDeliveryFunnel,
  getInventoryAndCatalog,
  getReturnsSummary,
  getWhales,
} from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const params = await searchParams;
  const returnsDays = [7, 14, 21, 30].includes(Number(params.days)) ? Number(params.days) : 30;

  let data;
  try {
    const [funnel, cashFlow, inventory, whales, bulkOrders, returns] = await Promise.all([
      getDeliveryFunnel(),
      getCashFlow(30),
      getInventoryAndCatalog(),
      getWhales(),
      getBulkOrders(30),
      getReturnsSummary(returnsDays),
    ]);
    data = { funnel, cashFlow, inventory, whales, bulkOrders, returns };
  } catch (err) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Live operations overview" />
        <SetupNotice error={err instanceof Error ? err.message : String(err)} />
      </div>
    );
  }

  const { funnel, cashFlow, inventory, whales, bulkOrders, returns } = data;

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description="Live operations overview" />

      {/* Operations summary */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatTile label="COD in flight" value={formatMoney(funnel.codInFlight)} />
          <StatTile
            label="Heading-back COD"
            value={formatMoney(funnel.headingBackCod)}
            tone={funnel.headingBackCod > 0 ? "warning" : "default"}
          />
          <StatTile label="Live stock value (at cost)" value={formatMoney(inventory.valueAtCost)} />
        </div>
      </section>

      {/* Delivery funnel */}
      <section>
        <Card title="Delivery funnel">
          <DeliveryFunnelChart data={funnel.stages} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
            {funnel.stages.map((s) => (
              <div key={s.status} className="border border-neutral-100 rounded-lg p-2">
                <p className="text-neutral-500">{s.status.replace(/_/g, " ")}</p>
                <p className="font-semibold">{formatNumber(s.count)} orders</p>
                <p className="text-neutral-400">{formatMoney(s.codSum)} COD</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Cash flow */}
      <section>
        <h2 className="text-sm font-semibold text-neutral-700 mb-3">Cash flow (last 30 days)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatTile
            label="COD collected — live"
            value={formatMoney(cashFlow.codLive)}
            sub="Collected by courier, not yet settled"
          />
          <StatTile
            label="COD collected — settled"
            value={formatMoney(cashFlow.codSettled)}
            tone="positive"
          />
          <StatTile label="Bosta fees owed" value={formatMoney(cashFlow.bostaFeesOwed)} tone="negative" />
          <StatTile
            label="Return head-back shipping cost"
            value={formatMoney(cashFlow.returnHeadbackShippingCost)}
            tone="negative"
          />
          <StatTile label="Hidden costs total" value={formatMoney(cashFlow.hiddenCostsTotal)} tone="negative" />
          <StatTile
            label="% paid flex/COD fee"
            value={formatPercent(cashFlow.flexFeePaidPct)}
            sub={`${formatNumber(cashFlow.codOrdersCount)} COD orders`}
          />
        </div>
      </section>

      {/* Inventory & catalog health */}
      <section>
        <h2 className="text-sm font-semibold text-neutral-700 mb-3">Inventory & catalog health</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile label="Live stock units" value={formatNumber(inventory.totalUnits)} />
          <StatTile label="Ending value (cost)" value={formatMoney(inventory.valueAtCost)} />
          <StatTile label="Ending value (retail)" value={formatMoney(inventory.valueAtRetail)} />
          <StatTile
            label="Barcode coverage"
            value={`${formatNumber(inventory.variantsWithBarcode)} / ${formatNumber(
              inventory.variantsWithBarcode + inventory.variantsWithoutBarcode
            )}`}
            sub={`${formatNumber(inventory.variantsWithoutBarcode)} missing barcodes`}
            tone={inventory.variantsWithoutBarcode > 0 ? "warning" : "positive"}
          />
        </div>
      </section>

      {/* Customers */}
      <section>
        <h2 className="text-sm font-semibold text-neutral-700 mb-3">Customers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatTile
            label="Whales (VIP)"
            value={formatNumber(whales.count)}
            sub={`${formatMoney(whales.totalRevenue)} combined revenue`}
          />
          <StatTile
            label="Bulk orders (last 30 days)"
            value={formatNumber(bulkOrders.count)}
            sub={`${formatMoney(bulkOrders.totalValue)} value · 3+ items`}
          />
        </div>
      </section>

      {/* Returns summary */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-neutral-700">Returns summary</h2>
          <DayRangeFilter basePath="/dashboard" activeDays={returnsDays} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <StatTile label="Completed exchanges" value={formatNumber(returns.exchangeCount)} />
          <StatTile label="Completed refunds" value={formatNumber(returns.refundCount)} />
          <StatTile label="Revenue recovered" value={formatMoney(returns.revenueRecovered)} tone="positive" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Funnel">
            <div className="flex flex-wrap gap-2">
              <Badge>Under review: {returns.funnel.under_review}</Badge>
              <Badge tone="info">Accepted: {returns.funnel.accepted}</Badge>
              <Badge tone="warning">Processing: {returns.funnel.processing}</Badge>
              <Badge tone="positive">Completed: {returns.funnel.completed}</Badge>
              <Badge tone="negative">Rejected: {returns.funnel.rejected}</Badge>
            </div>
            <p className="text-xs text-neutral-400 mt-3">{returns.totalRequests} total requests in range</p>
          </Card>
          <Card title="Return reasons">
            <ReturnReasonsChart data={returns.reasonBreakdown} />
          </Card>
        </div>
      </section>
    </div>
  );
}
