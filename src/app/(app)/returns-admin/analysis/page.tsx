import { PageHeader, Card, StatTile, Table, Badge, EmptyState } from "@/components/ui";
import SetupNotice from "@/components/setup-notice";
import DayRangeFilter from "@/components/day-range-filter";
import ReturnReasonsChart from "@/components/charts/return-reasons-chart";
import { formatMoney, formatNumber } from "@/lib/format";
import { getReturnsSummary } from "@/lib/metrics";
import { getMostReturnedProducts } from "@/lib/returns";

export const dynamic = "force-dynamic";

const RANGE_OPTIONS = [7, 14, 21, 30];

export default async function ReturnsAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const params = await searchParams;
  const days = RANGE_OPTIONS.includes(Number(params.days)) ? Number(params.days) : 30;

  let summary;
  let mostReturned;
  let error: string | null = null;
  try {
    [summary, mostReturned] = await Promise.all([
      getReturnsSummary(days),
      getMostReturnedProducts(days),
    ]);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <PageHeader title="Feedback & Analysis" description="Return reasons and most-returned products" />
        <DayRangeFilter basePath="/returns-admin/analysis" activeDays={days} options={RANGE_OPTIONS} />
      </div>

      {error || !summary || !mostReturned ? (
        <SetupNotice error={error ?? "Unknown error"} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile label="Total requests" value={formatNumber(summary.totalRequests)} />
            <StatTile label="Revenue recovered" value={formatMoney(summary.revenueRecovered)} tone="positive" />
            <StatTile
              label="Exchanges vs refunds"
              value={`${formatNumber(summary.exchangeCount)} / ${formatNumber(summary.refundCount)}`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Return reasons">
              <ReturnReasonsChart data={summary.reasonBreakdown} />
            </Card>

            <Card title="Most-returned products">
              {mostReturned.length === 0 ? (
                <EmptyState message="No returns in this range." />
              ) : (
                <Table columns={["Product", "Returns", "Units"]}>
                  {mostReturned.map((p) => (
                    <tr key={p.variantId ?? p.title}>
                      <td className="py-2 px-3">{p.title}</td>
                      <td className="py-2 px-3">{formatNumber(p.returnCount)}</td>
                      <td className="py-2 px-3">
                        <Badge tone="negative">{formatNumber(p.unitsReturned)}</Badge>
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
