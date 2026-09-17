"use client";

import { useState } from "react";
import { Card, Badge } from "@/components/ui";

type Result = { ok: boolean; data?: unknown; error?: string };

export default function ConnectionTest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ shopify: Result; bosta: Result } | null>(null);

  async function runTest() {
    setLoading(true);
    try {
      const res = await fetch("/api/test/connections");
      setResult(await res.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title="API connections">
      <button
        onClick={runTest}
        disabled={loading}
        className="rounded-lg bg-neutral-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 mb-4"
      >
        {loading ? "Testing…" : "Test Shopify & Bosta connections"}
      </button>

      {result && (
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium w-20">Shopify</span>
            <Badge tone={result.shopify.ok ? "positive" : "negative"}>
              {result.shopify.ok ? "Connected" : "Failed"}
            </Badge>
            {!result.shopify.ok && (
              <span className="text-neutral-500 text-xs">{result.shopify.error}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium w-20">Bosta</span>
            <Badge tone={result.bosta.ok ? "positive" : "negative"}>
              {result.bosta.ok ? "Connected" : "Failed"}
            </Badge>
            {!result.bosta.ok && (
              <span className="text-neutral-500 text-xs">{result.bosta.error}</span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
