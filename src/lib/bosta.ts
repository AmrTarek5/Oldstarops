/**
 * Bosta API client.
 *
 * Confirmed against a real, successful call (Sept 2026 - a live
 * `/deliveries/search` request against the OldStar business account):
 *   - Base URL: https://app.bosta.co/api/v2 (http:// 308-redirects to
 *     https, so we call https directly)
 *   - Auth: `Authorization: <api key>` - NO "Bearer" prefix. Bosta support
 *     confirmed this explicitly; docs.bosta.co's "Bearer Auth" label on the
 *     endpoint page is misleading for this key type.
 *   - Listing/filtering deliveries: POST /deliveries/search, JSON filter
 *     body (all fields optional: type, trackingNumbers, mobilePhones,
 *     businessReference, stateCodes). No page/limit in the body; passing
 *     none defaults to page 1 / limit 50, confirming pagination is via the
 *     query string as written below.
 *   - Response: `{ success, message, data: { deliveries: [...], count,
 *     page, limit } }`.
 *   - Delivery `state` is `{ code, value, deliveryTime, childState, ... }`.
 *     Confirmed codes from real orders: 10 "Pickup requested", 21 "Picked
 *     up from business", 24 "Received at warehouse", 45 "Delivered", 46
 *     "Returned to business", 47 "Exception". "Out for delivery" wasn't
 *     seen live but Bosta almost certainly has a code for it - the
 *     VALUE_KEYWORD_MAP fallback below catches it by label if the numeric
 *     code isn't in STATE_CODE_MAP yet.
 *   - Delivery `type` (separate from `state`!) is also `{ code, value }`:
 *     10 "Send" (forward), 20 "Return to Origin" (RTO), 30 "Exchange".
 *     `type.code === 20` is how a return leg is told apart from a normal
 *     delivery share the same state codes while in transit.
 *   - `shopifyInfo.orderId` (when present) is Shopify's numeric order id -
 *     a direct match to our `orders.id`. Far more reliable than parsing
 *     `businessReference`, which is `"<shopify-store-handle>:#<order
 *     number>"` (not a bare order number as originally assumed) and is the
 *     only link available on deliveries created manually from the Bosta
 *     dashboard (no `shopifyInfo` on those).
 *   - `updatedAt` comes back as a JS `Date#toString()`-style string (e.g.
 *     "Mon Sep 21 2026 13:06:14 GMT+0000 (...)"), not ISO 8601 - parse with
 *     `new Date(...)` and re-serialize before storing.
 *
 * Still NOT confirmed:
 *   - `pricing` was `{}` (empty) on every delivery seen so far, so the real
 *     field name for Bosta's fee/cost to the merchant is unknown -
 *     `extractBostaFee` below guesses a few common key names and falls
 *     back to 0. Check it again once a delivery shows a non-empty
 *     `pricing` object.
 *   - The full "Create delivery" payload shape used by createReturnPickup
 *     (a different endpoint from search - never live-tested).
 */
import type { DeliveryStatus } from "./types";

function baseUrl() {
  return process.env.BOSTA_API_BASE_URL || "https://app.bosta.co/api/v2";
}

function headers() {
  const key = process.env.BOSTA_API_KEY;
  if (!key) throw new Error("Missing BOSTA_API_KEY env var");
  return {
    Authorization: key,
    "Content-Type": "application/json",
  };
}

export class BostaApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`Bosta API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function bostaFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    throw new BostaApiError(res.status, body);
  }
  return res;
}

/**
 * Simple connectivity check used by the setup/test screen. Calls the same
 * /deliveries/search endpoint the real sync job uses, with an empty filter
 * (all deliveries), one page.
 */
export async function testBostaConnection() {
  const result = await fetchDeliveriesPage({ limit: 1 });
  return { ok: true, sampleCount: result.deliveries.length };
}

const RTO_TYPE_CODE = 20; // delivery `type.code` for "Return to Origin"

// Confirmed live from real OldStar deliveries (see file header). Anything
// not in this table falls back to matching the human-readable `value`.
const STATE_CODE_MAP: Record<number, DeliveryStatus> = {
  10: "new", // "Pickup requested"
  21: "with_bosta", // "Picked up from business"
  24: "with_bosta", // "Received at warehouse"
  45: "delivered", // "Delivered"
  47: "with_bosta", // "Exception" - still unresolved, package still with courier
  // 46 "Returned to business" is handled specially in mapBostaState: it
  // always means the package is physically back, regardless of type.
};

const VALUE_KEYWORD_MAP: Array<[RegExp, DeliveryStatus]> = [
  [/deliver/i, "delivered"],
  [/out for delivery/i, "out_for_delivery"],
  [/head(ing)? back|return(ed)? to origin|rto/i, "heading_back"],
  [/return(ed)? to business|fail|terminat|cancel/i, "failed"],
  [/pick(ed)?\s*up|transit|with courier|warehouse/i, "with_bosta"],
  [/pickup requested|created|new/i, "new"],
];

/**
 * Maps a delivery's Bosta state (and type, for telling a return leg apart
 * from a normal one while both are "in transit") to our internal status.
 */
export function mapBostaState(delivery: {
  type?: { code: number; value: string };
  state: { code: number; value: string };
}): DeliveryStatus {
  const { type, state } = delivery;

  if (state.code === 46) {
    // Physically back at the business - ready to restock/clear, whatever
    // the delivery type.
    return "failed";
  }

  if (type?.code === RTO_TYPE_CODE) {
    // A return-to-origin leg still in transit back (not yet arrived).
    return "heading_back";
  }

  if (state.code in STATE_CODE_MAP) return STATE_CODE_MAP[state.code];

  const match = VALUE_KEYWORD_MAP.find(([pattern]) => pattern.test(state.value));
  return match ? match[1] : "new";
}

/** Best-effort extraction of the courier fee. VERIFY once `pricing` is non-empty on a real delivery. */
export function extractBostaFee(pricing: Record<string, unknown> | undefined): number {
  if (!pricing) return 0;
  for (const key of ["deliveryFee", "totalFee", "fees", "total", "cost", "amount"]) {
    const val = pricing[key];
    if (typeof val === "number") return val;
  }
  return 0;
}

export interface BostaDelivery {
  _id: string;
  trackingNumber: string;
  type?: { code: number; value: string };
  state: {
    code: number;
    value: string;
    deliveryTime?: string | null;
  };
  cod: number;
  pricing?: Record<string, unknown>;
  businessReference?: string; // "<shopify-store-handle>:#<order number>"
  uniqueBusinessReference?: string;
  shopifyInfo?: {
    orderId: string; // matches orders.id directly
    storeName: string;
    orderNumber: string;
    createdAt: string;
  };
  updatedAt: string; // non-ISO Date#toString() format - parse with `new Date(...)`
}

export interface DeliverySearchFilter {
  stateCodes?: string[];
  page?: number;
  limit?: number;
}

/** Pulls deliveries matching an optional filter, paginated via query string (page/limit). */
export async function fetchDeliveriesPage(params: DeliverySearchFilter) {
  const limit = params.limit ?? 100;
  const page = params.page ?? 1;

  const res = await bostaFetch(`/deliveries/search?page=${page}&limit=${limit}`, {
    method: "POST",
    body: JSON.stringify({
      ...(params.stateCodes ? { stateCodes: params.stateCodes } : {}),
    }),
  });
  const json = (await res.json()) as {
    success: boolean;
    data: { deliveries: BostaDelivery[]; count?: number; page?: number; limit?: number };
  };
  const deliveries = json.data?.deliveries ?? [];

  return {
    deliveries,
    hasMore: deliveries.length === limit,
  };
}

/**
 * Creates a reverse-pickup delivery for a return/exchange.
 * VERIFY: real payload fields — never live-tested (only /deliveries/search
 * has been). Live orders show OldStar currently creates these manually as
 * "Exchange" (type.code 30) deliveries from the Bosta dashboard rather
 * than via API, so this payload shape is still a best guess.
 */
export async function createReturnPickup(input: {
  orderReference: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  city: string;
  notes?: string;
  packageDescription: string;
}) {
  const res = await bostaFetch("/deliveries", {
    method: "POST",
    body: JSON.stringify({
      type: "CUSTOMER_RETURN_PICKUP", // VERIFY: real type value/code
      orderReference: input.orderReference,
      notes: input.notes,
      dropOffAddress: {
        // OldStar warehouse — set via env or portal settings once confirmed
        city: process.env.BOSTA_WAREHOUSE_CITY || "Cairo",
      },
      receiver: {
        fullName: input.customerName,
        phone: input.customerPhone,
      },
      pickupAddress: {
        city: input.city,
        line1: input.customerAddress,
      },
      specs: {
        packageDetails: {
          description: input.packageDescription,
        },
      },
    }),
  });
  return (await res.json()) as { _id: string; trackingNumber: string };
}
