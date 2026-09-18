"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import type { ReturnPolicyRow } from "@/lib/types";

function toCsv(arr: string[]) {
  return arr.join(", ");
}
function fromCsv(str: string) {
  return str
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function PolicyForm({ policy }: { policy: ReturnPolicyRow }) {
  const router = useRouter();
  const [windowDays, setWindowDays] = useState(policy.window_days);
  const [finalSaleSkus, setFinalSaleSkus] = useState(toCsv(policy.final_sale_skus));
  const [allowedReasons, setAllowedReasons] = useState(toCsv(policy.allowed_reasons));
  const [blockedReasons, setBlockedReasons] = useState(toCsv(policy.blocked_reasons));
  const [autoApprove, setAutoApprove] = useState(policy.auto_approve);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          window_days: windowDays,
          final_sale_skus: fromCsv(finalSaleSkus),
          allowed_reasons: fromCsv(allowedReasons),
          blocked_reasons: fromCsv(blockedReasons),
          auto_approve: autoApprove,
        }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Return policy engine" className="max-w-xl">
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Return window (days)</label>
          <input
            type="number"
            min={0}
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
            className="w-32 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Final-sale SKUs (comma-separated)</label>
          <input
            value={finalSaleSkus}
            onChange={(e) => setFinalSaleSkus(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Allowed reasons (comma-separated)</label>
          <input
            value={allowedReasons}
            onChange={(e) => setAllowedReasons(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Blocked reasons (comma-separated)</label>
          <input
            value={blockedReasons}
            onChange={(e) => setBlockedReasons(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} />
          Auto-approve requests that match an allowed reason and are within the window
        </label>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-neutral-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save policy"}
        </button>
        {saved && <span className="ml-3 text-sm text-emerald-600">Saved</span>}
      </form>
    </Card>
  );
}
