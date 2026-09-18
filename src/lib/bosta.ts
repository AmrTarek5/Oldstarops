/**
 * Bosta API client.
 *
 * IMPORTANT: This sandbox has no outbound internet access, so the exact
 * endpoint paths, auth header format, and payload shapes below could NOT be
 * verified against Bosta's live API docs. They're written to match Bosta's
 * commonly-documented v2 REST shape, but before relying on this in
 * production:
 *   1. Log into the OldStar Bosta merchant dashboard and pull the API
 *      reference / Postman collection from Settings > API/Integrations.
 *   2. Confirm: base URL, auth header, the deliveries-list endpoint + its
 *      filters/pagination, the delivery state codes (STATE_CODES below),
 *      and the pickup-request payload shape.
 *   3. Update the few spots marked "VERIFY" — the rest of the app (sync job,
 *      status mapping, pickup automation) is written against this module's
 *      exported functions, so a wrong endpoint is a one-file fix.
 */
import type { DeliveryStatus } from "./types";

function baseUrl() {
  return process.env.BOSTA_API_BASE_URL || "https://app.bosta.co/api/v2";
}

function headers() {
  const key = process.env.BOSTA_API_KEY;
  if (!key) throw new Error("Missing BOSTA_API_KEY env var");
  // VERIFY: Bosta has historically accepted the raw API key in the
  // Authorization header (no "Bearer " prefix). Confirm against your
  // merchant docs and switch to `Bearer ${key}` if needed.
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
 * Simple connectivity check used by the setup/test screen. Reuses the same
 * deliveries-list endpoint the real sync job calls (rather than a separate
 * guessed "/business" endpoint) so the test actually validates the path
 * that matters. If this still 404s with a correct API key, VERIFY the
 * `/deliveries` path itself against your Bosta API reference.
 */
export async function testBostaConnection() {
  const result = await fetchDeliveriesPage({ limit: 1 });
  return { ok: true, sampleCount: result.deliveries.length };
}

// VERIFY: Bosta's actual state names/codes for delivery status. This map
// translates whatever string Bosta returns into our internal DeliveryStatus.
// Edit the left-hand keys to match real values once confirmed.
const STATE_MAP: Record<string, DeliveryStatus> = {
  CREATED: "new",
  PICKUP_REQUESTED: "new",
  PICKED_UP: "with_bosta",
  IN_TRANSIT: "with_bosta",
  OUT_FOR_DELIVERY: "out_for_delivery",
  HEADING_BACK: "heading_back",
  RETURNED_TO_ORIGIN: "heading_back",
  DELIVERED: "delivered",
  FAILED: "failed",
  CANCELED: "failed",
};

export function mapBostaState(state: string): DeliveryStatus {
  return STATE_MAP[state.toUpperCase()] ?? "new";
}

export interface BostaDelivery {
  _id: string;
  trackingNumber: string;
  state: string;
  cod: number;
  fees?: number;
  orderReference?: string; // expected to hold the Shopify order id/name
  updatedAt: string;
  deliveredAt?: string | null;
}

/**
 * Pulls deliveries updated since a given date, paginated.
 * VERIFY: real query param names (page/limit/updatedAfter) and response envelope.
 */
export async function fetchDeliveriesPage(params: {
  updatedAfter?: string;
  page?: number;
  limit?: number;
}) {
  const search = new URLSearchParams();
  search.set("limit", String(params.limit ?? 100));
  search.set("page", String(params.page ?? 1));
  if (params.updatedAfter) search.set("updatedAfter", params.updatedAfter);

  const res = await bostaFetch(`/deliveries?${search.toString()}`);
  const data = (await res.json()) as {
    data: BostaDelivery[];
    total?: number;
  };
  return {
    deliveries: data.data ?? [],
    hasMore: data.data && data.data.length === (params.limit ?? 100),
  };
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
