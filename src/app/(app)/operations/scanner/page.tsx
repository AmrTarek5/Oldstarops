"use client";

import { useRef, useState } from "react";
import { PageHeader, Card } from "@/components/ui";
import { formatMoney, formatNumber } from "@/lib/format";
import type { InventorySnapshotRow } from "@/lib/types";

export default function InventoryScannerPage() {
  const [barcode, setBarcode] = useState("");
  const [item, setItem] = useState<InventorySnapshotRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function lookup(code: string) {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setItem(null);
    try {
      const res = await fetch(`/api/ops/scanner/lookup?barcode=${encodeURIComponent(code.trim())}`);
      const data = await res.json();
      if (!res.ok) setError(data.error || "Not found");
      else setItem(data.item);
    } finally {
      setLoading(false);
      setBarcode("");
      inputRef.current?.focus();
    }
  }

  async function adjust(delta: number) {
    if (!item) return;
    const res = await fetch("/api/ops/scanner/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId: item.variant_id, delta }),
    });
    const data = await res.json();
    if (res.ok) setItem(data.item);
  }

  return (
    <div>
      <PageHeader title="Inventory Scanner" description="Scan a barcode (or type a SKU) to verify or adjust stock" />

      <Card className="max-w-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            lookup(barcode);
          }}
        >
          <input
            ref={inputRef}
            autoFocus
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Scan or type barcode / SKU…"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 mb-3"
          />
        </form>

        {loading && <p className="text-sm text-neutral-400">Looking up…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {item && (
          <div className="border-t border-neutral-100 pt-4 mt-2">
            <p className="font-semibold">{item.product_title}</p>
            {item.variant_title && <p className="text-sm text-neutral-500">{item.variant_title}</p>}
            <p className="text-xs text-neutral-400 font-mono mt-1">
              SKU {item.sku ?? "—"} · Barcode {item.barcode ?? "—"}
            </p>

            <div className="grid grid-cols-3 gap-3 mt-4">
              <div>
                <p className="text-xs text-neutral-500">Stock</p>
                <p className="text-lg font-semibold">{formatNumber(item.stock_qty)}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Cost</p>
                <p className="text-lg font-semibold">{formatMoney(item.cost)}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Retail</p>
                <p className="text-lg font-semibold">{formatMoney(item.retail_price)}</p>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => adjust(1)}
                className="rounded-lg bg-neutral-900 text-white px-3 py-1.5 text-sm font-medium"
              >
                +1 (restock)
              </button>
              <button
                onClick={() => adjust(-1)}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium"
              >
                −1
              </button>
            </div>
            <p className="text-xs text-neutral-400 mt-3">
              Adjustments here update OldStar Ops&apos; own record only — they don&apos;t push to
              Shopify. The next scheduled sync will overwrite this with Shopify&apos;s live count,
              so make the matching change in Shopify too if it needs to stick.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
