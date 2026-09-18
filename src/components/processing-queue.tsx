"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { ReturnRequestRow } from "@/lib/types";

function AcceptedCard({ r, onChange }: { r: ReturnRequestRow; onChange: () => void }) {
  const [pending, setPending] = useState(false);

  async function retryPickup() {
    setPending(true);
    try {
      const res = await fetch(`/api/returns-admin/${r.id}/create-pickup`, { method: "POST" });
      if (res.ok) onChange();
    } finally {
      setPending(false);
    }
  }

  async function startProcessing() {
    setPending(true);
    try {
      const res = await fetch(`/api/returns-admin/${r.id}/start-processing`, { method: "POST" });
      if (res.ok) onChange();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold">
            Order {r.order_number} · {r.customer_name ?? r.customer_email}
          </p>
          <p className="text-xs text-neutral-400">{formatDateTime(r.created_at)}</p>
        </div>
        <Badge tone={r.bosta_pickup_id ? "positive" : "warning"}>
          {r.bosta_pickup_id ? `Pickup ${r.bosta_pickup_id}` : "Pickup not created"}
        </Badge>
      </div>
      <p className="text-xs text-neutral-500 mb-3">
        {r.items.map((i) => `${i.quantity}× ${i.title}`).join(", ")}
      </p>
      <div className="flex gap-2">
        {!r.bosta_pickup_id && (
          <button
            onClick={retryPickup}
            disabled={pending}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            Create pickup
          </button>
        )}
        <button
          onClick={startProcessing}
          disabled={pending}
          className="rounded-md bg-neutral-900 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          Mark received → start processing
        </button>
      </div>
    </div>
  );
}

function ProcessingCard({ r, onChange }: { r: ReturnRequestRow; onChange: () => void }) {
  const [pending, setPending] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [revenueRecovered, setRevenueRecovered] = useState("");

  async function complete() {
    setPending(true);
    try {
      const res = await fetch(`/api/returns-admin/${r.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refundAmount: refundAmount ? Number(refundAmount) : undefined,
          revenueRecovered: revenueRecovered ? Number(revenueRecovered) : undefined,
        }),
      });
      if (res.ok) onChange();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold">
            Order {r.order_number} · {r.customer_name ?? r.customer_email}
          </p>
          <p className="text-xs text-neutral-400">{formatDateTime(r.created_at)}</p>
        </div>
        <Badge tone="info">{r.type}</Badge>
      </div>
      <p className="text-xs text-neutral-500 mb-3">
        {r.items.map((i) => `${i.quantity}× ${i.title}`).join(", ")}
      </p>
      <div className="flex items-end gap-3">
        {r.type === "return" ? (
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Refund amount</label>
            <input
              type="number"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              className="w-32 rounded-lg border border-neutral-300 px-2 py-1 text-xs"
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Revenue recovered</label>
            <input
              type="number"
              value={revenueRecovered}
              onChange={(e) => setRevenueRecovered(e.target.value)}
              className="w-32 rounded-lg border border-neutral-300 px-2 py-1 text-xs"
            />
          </div>
        )}
        <button
          onClick={complete}
          disabled={pending}
          className="rounded-md bg-neutral-900 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          Mark done
        </button>
      </div>
    </div>
  );
}

export default function ProcessingQueue({
  accepted,
  processing,
}: {
  accepted: ReturnRequestRow[];
  processing: ReturnRequestRow[];
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-neutral-700 mb-3">Accepted — awaiting pickup / receipt</h2>
        {accepted.length === 0 ? (
          <p className="text-sm text-neutral-400 py-4">Nothing here.</p>
        ) : (
          <div className="space-y-3">
            {accepted.map((r) => (
              <AcceptedCard key={r.id} r={r} onChange={refresh} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-neutral-700 mb-3">Processing</h2>
        {processing.length === 0 ? (
          <p className="text-sm text-neutral-400 py-4">Nothing here.</p>
        ) : (
          <div className="space-y-3">
            {processing.map((r) => (
              <ProcessingCard key={r.id} r={r} onChange={refresh} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
