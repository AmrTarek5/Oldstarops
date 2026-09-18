"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Table, Badge } from "@/components/ui";
import { formatMoney, formatDateTime } from "@/lib/format";
import type { FailedDeliveryRow } from "@/lib/ops";

export default function FailedDeliveriesTable({ rows }: { rows: FailedDeliveryRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function act(deliveryId: string, action: "restock" | "clear") {
    setPending(deliveryId);
    try {
      const res = await fetch(`/api/ops/failed-deliveries/${deliveryId}/${action}`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <Table columns={["Tracking #", "Order", "Customer", "Items", "COD", "Updated", "Actions"]}>
      {rows.map((r) => (
        <tr key={r.deliveryId}>
          <td className="py-2 px-3 font-mono text-xs">{r.trackingNumber}</td>
          <td className="py-2 px-3">{r.orderNumber ?? "—"}</td>
          <td className="py-2 px-3">{r.customerName ?? "—"}</td>
          <td className="py-2 px-3 text-xs text-neutral-500">
            {r.items.map((i) => `${i.quantity}× ${i.title}`).join(", ") || "—"}
          </td>
          <td className="py-2 px-3">
            <Badge tone="negative">{formatMoney(r.codAmount)}</Badge>
          </td>
          <td className="py-2 px-3 text-xs text-neutral-500">{formatDateTime(r.updatedAt)}</td>
          <td className="py-2 px-3">
            <div className="flex gap-2">
              <button
                disabled={pending === r.deliveryId}
                onClick={() => act(r.deliveryId, "restock")}
                className="rounded-md bg-neutral-900 text-white px-2 py-1 text-xs disabled:opacity-50"
              >
                Restock
              </button>
              <button
                disabled={pending === r.deliveryId}
                onClick={() => act(r.deliveryId, "clear")}
                className="rounded-md border border-neutral-300 px-2 py-1 text-xs disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </td>
        </tr>
      ))}
    </Table>
  );
}
