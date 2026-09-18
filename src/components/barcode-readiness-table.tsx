"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Table } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import type { MissingBarcodeRow } from "@/lib/ops";

export default function BarcodeReadinessTable({ rows }: { rows: MissingBarcodeRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(variantId: string) {
    setPending(variantId);
    setError(null);
    try {
      const res = await fetch("/api/ops/barcodes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Failed to generate barcode");
      else router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function generateAll() {
    setBulkPending(true);
    setError(null);
    try {
      const res = await fetch("/api/ops/barcodes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantIds: rows.map((r) => r.variantId) }),
      });
      if (res.ok) router.refresh();
      else setError("Bulk generation failed");
    } finally {
      setBulkPending(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-neutral-500">
          Generates a new internal EAN-13 barcode and writes it to Shopify. Existing barcodes are
          never overwritten.
        </p>
        <button
          onClick={generateAll}
          disabled={bulkPending || rows.length === 0}
          className="rounded-lg bg-neutral-900 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          {bulkPending ? "Generating…" : `Generate all (${rows.length})`}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <Table columns={["Product", "Variant", "SKU", "Stock", "Action"]}>
        {rows.map((r) => (
          <tr key={r.variantId}>
            <td className="py-2 px-3">{r.productTitle}</td>
            <td className="py-2 px-3 text-neutral-500">{r.variantTitle ?? "—"}</td>
            <td className="py-2 px-3 font-mono text-xs">{r.sku ?? "—"}</td>
            <td className="py-2 px-3">{formatNumber(r.stockQty)}</td>
            <td className="py-2 px-3">
              <button
                onClick={() => generate(r.variantId)}
                disabled={pending === r.variantId}
                className="rounded-md border border-neutral-300 px-2 py-1 text-xs disabled:opacity-50 hover:bg-neutral-50"
              >
                {pending === r.variantId ? "Generating…" : "Generate barcode"}
              </button>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
