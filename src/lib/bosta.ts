/**
 * Bosta API client.
 *
 * Confirmed against docs.bosta.co's live reference (Sept 2026):
 *   - Base URL: https://app.bosta.co/api/v2 (the docs show http://, but the
 *     server 308-redirects http -> https, so we call https directly)
 *   - Auth: `Authorization: Bearer <api key>` (not the raw key)
 *   - Listing/filtering deliveries: POST /deliveries/search (not a GET
 *     /deliveries as originally guessed), body is a JSON filter object
 *     (type, trackingNumbers, mobilePhones, businessReference, stateCodes)
 *   - Delivery `state` is `{ code: number, value: string }`, e.g.
 *     `{ code: 10, value: "Pickup requested" }` - only code 10 is confirmed
 *     so far; the rest of STATE_MAP below is inferred and marked VERIFY.
 *
 * Still NOT confirmed (marked VERIFY below) since we haven't seen a real
 * successful response yet:
 *   - Whether /deliveries/search's response `data` is an array directly, an
 *     object with a nested list field, or paginated - the docs example
 *     showed a single object that looked like it was actually the "Create
 *     delivery" endpoint's example, not this one's.
 *   - Pagination params (query string vs body) for /deliveries/search.
 *   - The full "Create delivery" payload shape used by createReturnPickup.
 *   - The rest of the numeric state codes beyond 10.
 * Re-run a search with a real, working API key once you have one and the
 * response will answer all of these - update this file to match.
 */
import type { DeliveryStatus } from "./types";

function baseUrl() {
  return process.env.BOSTA_API_BASE_URL || "https://app.bosta.co/api/v2";
}

function headers() {
  const key = process.env.BOSTA_API_KEY;
  if (!key) throw new Error("Missing BOSTA_API_KEY env var");
  return {
    Authorization: `Bearer ${key}`,
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

// Only code 10 ("Pickup requested") is confirmed from docs.bosta.co. The
// rest are inferred from typical last-mile courier flows - VERIFY each one
// against a real response and correct the numbers/labels as needed. The
// `mapBostaState` fallback below also matches on the human-readable `value`
// text as a safety net for codes not yet listed here.
const STATE_CODE_MAP: Record<number, DeliveryStatus> = {
  10: "new", // "Pickup requested"
  20: "with_bosta", // guessed: picked up
  30: "with_bosta", // guessed: in transit
  40: "out_for_delivery", // guessed
  41: "delivered", // guessed
  45: "heading_back", // guessed: returned to origin
  46: "failed", // guessed: delivery failed / terminated
};

const VALUE_KEYWORD_MAP: Array<[RegExp, DeliveryStatus]> = [
  [/deliver/i, "delivered"],
  [/out for delivery/i, "out_for_delivery"],
  [/head(ing)? back|return(ed)? to origin|rto/i, "heading_back"],
  [/fail|terminat|cancel/i, "failed"],
  [/pick(ed)?\s*up|transit|with courier/i, "with_bosta"],
  [/pickup requested|created|new/i, "new"],
];

export function mapBostaState(state: { code: number; value: string }): DeliveryStatus {
  if (state.code in STATE_CODE_MAP) return STATE_CODE_MAP[state.code];
  const match = VALUE_KEYWORD_MAP.find(([pattern]) => pattern.test(state.value));
  return match ? match[1] : "new";
}

export interface BostaDelivery {
  _id: string;
  trackingNumber: string;
  state: { code: number; value: string };
  cod: number;
  fees?: number;
  businessReference?: string; // expected to hold the Shopify order id/name
  updatedAt: string;
  deliveredAt?: string | null;
}

/**
 * Pulls deliveries matching an optional filter, paginated.
 * VERIFY once a working API key is available:
 *   - Whether `page`/`limit` belong in the query string (as written) or the
 *     JSON body instead.
 *   - The exact shape of the response's `data` (array vs `{ deliveries, total }`
 *     vs something else) - `parseDeliveries` below tries a few common shapes.
 */
export async function fetchDeliveriesPage(params: {
  stateCodes?: string[];
  page?: number;
  limit?: number;
}) {
  const limit = params.limit ?? 100;
  const page = params.page ?? 1;

  const res = await bostaFetch(`/deliveries/search?page=${page}&limit=${limit}`, {
    method: "POST",
    body: JSON.stringify({
      ...(params.stateCodes ? { stateCodes: params.stateCodes } : {}),
    }),
  });
  const json = (await res.json()) as { success: boolean; data: unknown };
  const deliveries = parseDeliveries(json.data);

  return {
    deliveries,
    hasMore: deliveries.length === limit,
  };
}

function parseDeliveries(data: unknown): BostaDelivery[] {
  if (Array.isArray(data)) return data as BostaDelivery[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.deliveries)) return obj.deliveries as BostaDelivery[];
    if (Array.isArray(obj.data)) return obj.data as BostaDelivery[];
    if (Array.isArray(obj.items)) return obj.items as BostaDelivery[];
    // A single delivery object (not wrapped in a list) - treat as a 1-item page.
    if ("_id" in obj && "trackingNumber" in obj) return [obj as unknown as BostaDelivery];
  }
  return [];
}

/**
 * Creates a reverse-pickup delivery for a return/exchange.
 * VERIFY: real payload fields — Bosta typically requires pickup address
 * (defaults to the merchant's registered pickup location), a dropoff/return
 * address (the OldStar warehouse), contact info, package description, and a
 * delivery "type" distinguishing a customer-return pickup from a normal
 * outbound delivery.
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
