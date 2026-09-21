"use client";

import { useEffect, useState } from "react";
import type { DesiredItem, OrderLineItem } from "@/lib/types";
import type { PublicProduct } from "@/app/api/public/products/route";

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
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [notes, setNotes] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [desiredItems, setDesiredItems] = useState<DesiredItem[]>([]);
  const [pickProductId, setPickProductId] = useState("");
  const [pickOptions, setPickOptions] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/public/products")
      .then((res) => res.json())
      .then((data) => setProducts(data.products ?? []))
      .catch(() => undefined);
  }, []);

  const pickProduct = products.find((p) => p.productId === pickProductId) ?? null;
  const pickOptionNames = pickProduct?.variants[0]?.options.map((o) => o.name) ?? [];
  const pickMatchedVariant = pickProduct?.variants.find(
    (v) =>
      v.options.length === pickOptionNames.length &&
      v.options.every((o) => pickOptions[o.name] === o.value)
  );

  function optionValuesFor(name: string) {
    if (!pickProduct) return [];
    const values = new Set<string>();
    for (const v of pickProduct.variants) {
      const match = v.options.find((o) => o.name === name);
      if (match) values.add(match.value);
    }
    return Array.from(values);
  }

  function addDesiredItem() {
    if (!pickProduct || !pickMatchedVariant) return;
    setDesiredItems((prev) => [
      ...prev,
      {
        variant_id: pickMatchedVariant.variantId,
        product_title: pickProduct.productTitle,
        options: pickMatchedVariant.options,
        sku: pickMatchedVariant.sku,
        quantity: 1,
      },
    ]);
    setPickProductId("");
    setPickOptions({});
  }

  function removeDesiredItem(idx: number) {
    setDesiredItems((prev) => prev.filter((_, i) => i !== idx));
  }

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
    if (desiredItems.length === 0) {
      setError("Choose what you'd like instead");
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
          reason: reason === "other" ? customReason : reason,
          notes,
          items,
          desiredItems,
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
        <p className="text-sm font-medium mb-2">What would you like instead?</p>
        <p className="text-xs text-neutral-500 mb-3">We only offer exchanges — pick the product, color and size you&apos;d like to receive.</p>

        {desiredItems.length > 0 && (
          <div className="space-y-2 mb-3">
            {desiredItems.map((d, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-sm bg-neutral-50 rounded-lg px-3 py-2"
              >
                <span>
                  {d.product_title}
                  {d.options.length > 0 && ` — ${d.options.map((o) => o.value).join(" / ")}`}
                </span>
                <button
                  type="button"
                  onClick={() => removeDesiredItem(idx)}
                  className="text-xs text-neutral-400 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="border border-neutral-200 rounded-lg p-3 space-y-2">
          <select
            value={pickProductId}
            onChange={(e) => {
              setPickProductId(e.target.value);
              setPickOptions({});
            }}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">Select a product…</option>
            {products.map((p) => (
              <option key={p.productId} value={p.productId}>
                {p.productTitle}
              </option>
            ))}
          </select>

          {pickProduct &&
            pickOptionNames.map((name) => (
              <select
                key={name}
                value={pickOptions[name] ?? ""}
                onChange={(e) => setPickOptions((prev) => ({ ...prev, [name]: e.target.value }))}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="">{name}…</option>
                {optionValuesFor(name).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            ))}

          <button
            type="button"
            onClick={addDesiredItem}
            disabled={!pickMatchedVariant}
            className="w-full rounded-lg border border-neutral-300 py-1.5 text-xs font-medium disabled:opacity-40"
          >
            Add to exchange
          </button>
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
