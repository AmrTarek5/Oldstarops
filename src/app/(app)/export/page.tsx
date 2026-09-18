import { PageHeader, Card, ExportLink } from "@/components/ui";

export const dynamic = "force-dynamic";

const EXPORTS: Array<{ type: string; label: string; description: string; days?: boolean }> = [
  { type: "orders", label: "Orders", description: "All synced Shopify orders", days: true },
  { type: "returns", label: "Returns & exchanges", description: "All return/exchange requests", days: true },
  { type: "inventory", label: "Inventory", description: "Current stock, cost, and retail price per variant" },
  { type: "failed-deliveries", label: "Failed deliveries", description: "Unresolved failed deliveries" },
  { type: "in-transit", label: "In-transit stock", description: "Orders currently with Bosta" },
  { type: "shipping-reconciliation", label: "Shipping reconciliation", description: "Shipping charged vs. Bosta cost", days: true },
  { type: "bulk-orders", label: "Bulk orders", description: "Orders with 3+ items", days: true },
  { type: "whales", label: "Whales (VIP)", description: "VIP customers and lifetime spend" },
  { type: "product-profit", label: "Per-product profit", description: "Gross profit per SKU" },
];

export default function ExportPage() {
  return (
    <div>
      <PageHeader title="Export" description="Download CSVs of operations, returns, and inventory data" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {EXPORTS.map((e) => (
          <Card key={e.type}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-sm">{e.label}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{e.description}</p>
              </div>
              <ExportLink type={e.type} days={e.days ? 30 : undefined} label="CSV" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
