"use client";

import { useRef, useState } from "react";
import { Card, Badge } from "@/components/ui";
import { formatMoney, formatNumber } from "@/lib/format";
import type { OrderLineItem } from "@/lib/types";

type ScanResult =
  | {
      kind: "failed_delivery";
      deliveryId: string;
      trackingNumber: string;
      codAmount: number;
      orderNumber: string | null;
      customerName: string | null;
      items: OrderLineItem[];
    }
  | {
      kind: "return_pickup";
      returnId: string;
      orderNumber: string | null;
      customerName: string | null;
      status: string;
      type: string;
      items: OrderLineItem[];
    };

export default function ReturnScannerClient({ initialFailedCount }: { initialFailedCount: number }) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failedCount, setFailedCount] = useState(initialFailedCount);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refreshCount() {
    const res = await fetch("/api/ops/return-scanner/failed-count");
    const data = await res.json();
    if (res.ok) setFailedCount(data.count);
  }

  async function scan(value: string) {
    if (!value.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/ops/return-scanner/lookup?code=${encodeURIComponent(value.trim())}`);
      const data = await res.json();
      if (!res.ok) setError(data.error || "Not found");
      else setResult(data);
    } finally {
      setLoading(false);
      setCode("");
      inputRef.current?.focus();
    }
  }

  async function restock() {
    if (result?.kind !== "failed_delivery") return;
    await fetch(`/api/ops/failed-deliveries/${result.deliveryId}/restock`, { method: "POST" });
    setResult(null);
    refreshCount();
  }

  async function clear() {
    if (result?.kind !== "failed_delivery") return;
    await fetch(`/api/ops/failed-deliveries/${result.deliveryId}/clear`, { method: "POST" });
    setResult(null);
    refreshCount();
  }

  async function startProcessing() {
    if (result?.kind !== "return_pickup") return;
    await fetch(`/api/returns-admin/${result.returnId}/start-processing`, { method: "POST" });
    setResult(null);
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Badge tone={failedCount > 0 ? "warning" : "positive"}>
          {formatNumber(failedCount)} failed deliveries to process
        </Badge>
      </div>

      <Card className="max-w-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            scan(code);
          }}
        >
          <input
            ref={inputRef}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Scan or type tracking number…"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 mb-3"
          />
        </form>

        {loading && <p className="text-sm text-neutral-400">Looking up…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {result && (
          <div className="border-t border-neutral-100 pt-4 mt-2">
            <div className="flex items-center gap-2 mb-2">
              <Badge tone={result.kind === "failed_delivery" ? "negative" : "info"}>
                {result.kind === "failed_delivery" ? "Failed delivery" : `Return pickup (${result.status})`}
              </Badge>
            </div>
            <p className="font-semibold">{result.orderNumber ?? "—"}</p>
            <p className="text-sm text-neutral-500">{result.customerName ?? "—"}</p>
            <p className="text-xs text-neutral-400 mt-1">
              {result.items.map((i) => `${i.quantity}× ${i.title}`).join(", ")}
            </p>
            {result.kind === "failed_delivery" && (
              <p className="text-sm mt-2">COD: {formatMoney(result.codAmount)}</p>
            )}

            <div className="flex gap-2 mt-4">
              {result.kind === "failed_delivery" ? (
                <>
                  <button
                    onClick={restock}
                    className="rounded-lg bg-neutral-900 text-white px-3 py-1.5 text-sm font-medium"
                  >
                    Restock
                  </button>
                  <button
                    onClick={clear}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium"
                  >
                    Clear
                  </button>
                </>
              ) : (
                <button
                  onClick={startProcessing}
                  className="rounded-lg bg-neutral-900 text-white px-3 py-1.5 text-sm font-medium"
                >
                  Mark received → start processing
                </button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
