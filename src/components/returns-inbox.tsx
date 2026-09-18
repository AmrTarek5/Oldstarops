"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { ReturnRequestRow } from "@/lib/types";

function AiReviewBadge({ aiReview }: { aiReview: Record<string, unknown> | null }) {
  if (!aiReview) return null;
  const flagged = Boolean(aiReview.flagForHumanReview);
  const condition = String(aiReview.condition ?? "unclear");
  return (
    <Badge tone={flagged ? "warning" : "default"}>
      AI: {condition}
      {flagged ? " · flagged" : ""}
    </Badge>
  );
}

export default function ReturnsInbox({ requests }: { requests: ReturnRequestRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  async function act(id: string, action: "accept" | "reject") {
    setPending(id);
    try {
      const res = await fetch(`/api/returns-admin/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesById[id] }),
      });
      if (res.ok) router.refresh();
    } finally {
      setPending(null);
    }
  }

  if (requests.length === 0) {
    return <p className="text-sm text-neutral-400 py-8 text-center">No requests under review.</p>;
  }

  return (
    <div className="space-y-4">
      {requests.map((r) => (
        <div key={r.id} className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-semibold">
                Order {r.order_number} · {r.customer_name ?? r.customer_email}
              </p>
              <p className="text-xs text-neutral-400">{formatDateTime(r.created_at)}</p>
            </div>
            <div className="flex gap-2">
              <Badge tone="info">{r.type}</Badge>
              <AiReviewBadge aiReview={r.ai_review} />
            </div>
          </div>

          <p className="text-sm mb-1">
            <span className="font-medium">Reason:</span> {r.reason.replace(/_/g, " ")}
          </p>
          {r.notes && <p className="text-sm text-neutral-500 mb-2">&ldquo;{r.notes}&rdquo;</p>}

          <p className="text-xs text-neutral-500 mb-2">
            {r.items.map((i) => `${i.quantity}× ${i.title}`).join(", ")}
          </p>

          {r.ai_review && (
            <p className="text-xs text-neutral-500 mb-2 bg-neutral-50 rounded-lg p-2">
              {String(r.ai_review.notes ?? "")}
            </p>
          )}

          {r.photo_urls.length > 0 && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {r.photo_urls.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt="Return item" className="w-20 h-20 object-cover rounded-lg border" />
              ))}
            </div>
          )}

          <input
            placeholder="Notes (optional, shown on reject)"
            value={notesById[r.id] ?? ""}
            onChange={(e) => setNotesById((prev) => ({ ...prev, [r.id]: e.target.value }))}
            className="w-full mb-3 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
          />

          <div className="flex gap-2">
            <button
              onClick={() => act(r.id, "accept")}
              disabled={pending === r.id}
              className="rounded-md bg-neutral-900 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              Accept
            </button>
            <button
              onClick={() => act(r.id, "reject")}
              disabled={pending === r.id}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
