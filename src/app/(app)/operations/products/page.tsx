import { PageHeader, Table, Badge, EmptyState, ExportLink } from "@/components/ui";
import SetupNotice from "@/components/setup-notice";
import { formatMoney, formatNumber } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface ProductProfitRow {
  variant_id: string;
  title: string;
  sku: string | null;
  units_sold: number;
  revenue: number;
  cost_of_goods: number;
  gross_profit: number;
  stock_qty: number;
  stock_value_at_cost: number;
}

export default async function ProductProfitPage() {
  let rows: ProductProfitRow[];
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("v_product_profit")
      .select("*")
      .order("gross_profit", { ascending: true });
    if (error) throw error;
    rows = data ?? [];
  } catch (err) {
    return (
      <div>
        <PageHeader title="Per-Product Profit" />
        <SetupNotice error={err instanceof Error ? err.message : String(err)} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Per-Product Profit"
        description="Gross profit per SKU — money-losers surfaced first"
        action={<ExportLink type="product-profit" />}
      />

      {rows.length === 0 ? (
        <EmptyState message="No sales data yet." />
      ) : (
        <div className="bg-white border border-neutral-200 rounded-xl p-2">
          <Table columns={["Product", "SKU", "Units sold", "Revenue", "COGS", "Gross profit", "Stock value (cost)"]}>
            {rows.map((r) => (
              <tr key={r.variant_id}>
                <td className="py-2 px-3">{r.title}</td>
                <td className="py-2 px-3 font-mono text-xs">{r.sku ?? "—"}</td>
                <td className="py-2 px-3">{formatNumber(r.units_sold)}</td>
                <td className="py-2 px-3">{formatMoney(r.revenue)}</td>
                <td className="py-2 px-3 text-neutral-500">{formatMoney(r.cost_of_goods)}</td>
                <td className="py-2 px-3">
                  <Badge tone={r.gross_profit < 0 ? "negative" : "positive"}>
                    {formatMoney(r.gross_profit)}
                  </Badge>
                </td>
                <td className="py-2 px-3 text-neutral-500">{formatMoney(r.stock_value_at_cost)}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </div>
  );
}
