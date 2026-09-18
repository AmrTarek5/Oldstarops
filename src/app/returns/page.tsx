"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReturnsLandingPage() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const cleaned = orderNumber.trim().replace(/^#/, "");
          if (cleaned) router.push(`/returns/${encodeURIComponent(cleaned)}`);
        }}
        className="w-full max-w-sm bg-white border border-neutral-200 rounded-xl p-8 shadow-sm"
      >
        <h1 className="text-xl font-semibold mb-1">Start a return or exchange</h1>
        <p className="text-sm text-neutral-500 mb-6">Enter your order number to get started.</p>

        <label className="block text-sm font-medium mb-1">Order number</label>
        <input
          required
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="#1234"
          className="w-full mb-4 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
        />

        <button
          type="submit"
          className="w-full rounded-lg bg-neutral-900 text-white py-2 text-sm font-medium"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
