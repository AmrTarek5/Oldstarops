"use client";

import { useState } from "react";
import type { OrderLineItem } from "@/lib/types";

interface LookupResult {
  order: {
    id: string;
    orderNumber: string;
    createdAt: string;
    items: OrderLineItem[];
    customerName: string | null;
    customerEmail: string;
  };
  eligible: boolean;
  windowDays: number;
  allowedReasons: string[];
}

export default function ReturnsPortalForm({
  orderNumber,
  primaryColor,
  policyText,
}: {
  orderNumber: string;
  primaryColor: string;
  policyText: string | null;
}) {
  const [step, setStep] = useState<"verify" | "form" | "done">("verify");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lookup, setLookup] = useState<LookupResult | null>(null);

  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [type, setType] = useState<"return" | "exchange">("return");
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [notes, setNotes] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public/returns/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Order not found");
        return;
      }
      setLookup(data);
      setReason(data.allowedReasons?.[0] ?? "");
      setStep("form");
    } finally {
      setLoading(false);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/public/returns/upload-photo", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (res.ok) setPhotoUrls((prev) => [...prev, data.url]);
      }
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!lookup) return;
    const items = lookup.order.items.filter((_, idx) => selected[idx]);
    if (items.length === 0) {
      setError("Select at least one item");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public/returns/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber,
          email,
          type,
          reason: reason === "other" ? customReason : reason,
          notes,
          items,
          photoUrls,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      setResultMessage(data.message);
      setStep("done");
    } finally {
      setLoading(false);
    }
  }

  if (step === "verify") {
    return (
      <form onSubmit={verify} className="bg-white border border-neutral-200 rounded-xl p-8">
        <h1 className="text-xl font-semibold mb-1">Order #{orderNumber}</h1>
        <p className="text-sm text-neutral-500 mb-6">
          Confirm the email used for this order to continue.
        </p>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{ backgroundColor: primaryColor }}
          className="w-full rounded-lg text-white py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Checking…" : "Continue"}
        </button>
      </form>
    );
  }

  if (step === "done") {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
        <h1 className="text-xl font-semibold mb-2">Request submitted</h1>
        <p className="text-sm text-neutral-600">{resultMessage}</p>
      </div>
    );
  }

  if (!lookup) return null;

  if (!lookup.eligible) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
        <h1 className="text-xl font-semibold mb-2">Outside return window</h1>
        <p className="text-sm text-neutral-600">
          This order is outside the {lookup.windowDays}-day return window.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-white border border-neutral-200 rounded-xl p-8 space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Order #{lookup.order.orderNumber}</h1>
        {policyText && <p className="text-xs text-neutral-500 mt-1">{policyText}</p>}
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Which items?</p>
        <div className="space-y-2">
          {lookup.order.items.map((item, idx) => (
            <label key={idx} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!selected[idx]}
                onChange={(e) => setSelected((prev) => ({ ...prev, [idx]: e.target.checked }))}
              />
              {item.quantity}× {item.title}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Type</p>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1">
            <input type="radio" checked={type === "return"} onChange={() => setType("return")} />
            Return for refund
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" checked={type === "exchange"} onChange={() => setType("exchange")} />
            Exchange
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Reason</label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          {lookup.allowedReasons.map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, " ")}
            </option>
          ))}
          <option value="other">Other</option>
        </select>
        {reason === "other" && (
          <input
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Tell us why"
            className="w-full mt-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Photos of item condition</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="text-sm"
        />
        {uploading && <p className="text-xs text-neutral-400 mt-1">Uploading…</p>}
        {photoUrls.length > 0 && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {photoUrls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="Uploaded item" className="w-16 h-16 object-cover rounded-lg border" />
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || uploading}
        style={{ backgroundColor: primaryColor }}
        className="w-full rounded-lg text-white py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Submitting…" : "Submit request"}
      </button>
    </form>
  );
}
