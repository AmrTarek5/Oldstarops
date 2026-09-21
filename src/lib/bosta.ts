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
  dropOffAddress?: { city?: { name?: string } };
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

type EstimateDeliveryType = "SEND" | "CASH_COLLECTION" | "CUSTOMER_RETURN_PICKUP" | "EXCHANGE" | "SIGN_AND_RETURN";

// Delivery `type.code` (from a real delivery, see BostaDelivery.type) ->
// the pricing calculator's type enum, which doesn't have an RTO option -
// CUSTOMER_RETURN_PICKUP is the closest reverse-logistics analog for one.
const DELIVERY_TYPE_TO_ESTIMATE_TYPE: Record<number, EstimateDeliveryType> = {
  10: "SEND",
  20: "CUSTOMER_RETURN_PICKUP",
  30: "EXCHANGE",
};

/**
 * Estimates what Bosta would charge for a delivery via their pricing
 * calculator (GET /pricing/shipment/calculator) - confirmed live, e.g. a
 * Cairo->Cairo SEND with cod=100 returned `shippingFee: 75`,
 * `priceAfterVat: 85.5` (14% VAT), plus two more per-delivery line items
 * both flagged active in OldStar's plan (`tier.configurations`):
 * `bostaMaterialFee.amount: 55` and `tier.openingPackageFee.amount: 7`
 * (opening-package fee applies since deliveries are created with
 * `allowToOpenPackage: true`, matching OldStar's real ones). The total
 * returned here is `priceAfterVat + bostaMaterialFee + openingPackageFee`.
 *
 * Still an approximation, not a real invoice: it's unconfirmed whether VAT
 * applies to the material/opening-package add-ons too (the response
 * doesn't show a VAT-inclusive version of them, so they're added as flat
 * amounts), and `tier.pickupFee` (70 EGP, with a
 * `numberOfOrdersThreshold: 2`) looks like it's amortized across a whole
 * pickup batch rather than charged per delivery, so it's excluded here.
 *
 * This is an ESTIMATE based on OldStar's plan/tier and route, not the
 * actual billed amount - Bosta doesn't expose that per-delivery (the
 * `pricing` field has been empty on every real delivery seen so far, see
 * `extractBostaFee`). Used as a fallback for the Shipping Reconciliation
 * `bosta_fee` figure when no real pricing data is available. Best-effort:
 * returns null rather than throwing, so a pricing hiccup never blocks the
 * delivery sync itself.
 */
export async function estimateShippingFee(params: {
  pickupCity: string;
  dropOffCity: string;
  type: EstimateDeliveryType;
  size?: "Normal" | "Light Bulky" | "Heavy Bulky";
  cod?: number;
}): Promise<number | null> {
  try {
    const search = new URLSearchParams({
      pickupCity: params.pickupCity,
      dropOffCity: params.dropOffCity,
      type: params.type,
      size: params.size ?? "Normal",
      cod: String(params.cod ?? 0),
    });
    const res = await bostaFetch(`/pricing/shipment/calculator?${search.toString()}`);
    const json = (await res.json()) as {
      success: boolean;
      data?: {
        priceAfterVat?: number;
        tier?: {
          bostaMaterialFee?: { amount?: number };
          openingPackageFee?: { amount?: number };
        };
      };
    };
    if (!json.success || typeof json.data?.priceAfterVat !== "number") return null;

    const materialFee = json.data.tier?.bostaMaterialFee?.amount ?? 0;
    const openingFee = json.data.tier?.openingPackageFee?.amount ?? 0;
    return json.data.priceAfterVat + materialFee + openingFee;
  } catch {
    return null;
  }
}

/**
 * Resolves the fee to record for a delivery: prefers real data from the
 * delivery's own `pricing` field, falls back to a live pricing-calculator
 * estimate, falls back to 0. `cache` lets a sync run reuse estimates
 * across deliveries with the same destination city/type instead of
 * calling the calculator once per delivery.
 */
export async function resolveBostaFee(
  delivery: BostaDelivery,
  warehouseCity: string,
  cache: Map<string, number | null>
): Promise<number> {
  const realFee = extractBostaFee(delivery.pricing);
  if (realFee > 0) return realFee;

  const dropOffCity = delivery.dropOffAddress?.city?.name || warehouseCity;
  const estimateType = DELIVERY_TYPE_TO_ESTIMATE_TYPE[delivery.type?.code ?? 10] ?? "SEND";
  const cacheKey = `${dropOffCity}|${estimateType}`;

  if (!cache.has(cacheKey)) {
    const estimate = await estimateShippingFee({
      pickupCity: warehouseCity,
      dropOffCity,
      type: estimateType,
    });
    cache.set(cacheKey, estimate);
  }
  return cache.get(cacheKey) ?? 0;
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
 * Creates a return/exchange delivery via Bosta's "Create delivery" endpoint
 * (POST /deliveries), payload confirmed against docs.bosta.co's own
 * example. Two things this couldn't fully resolve yet:
 *
 *   1. `type`: the request takes a NUMERIC code here (unlike the string
 *      enum /deliveries/search's `type` filter takes). We don't have a
 *      confirmed code for a pure customer-return-for-refund. What IS
 *      confirmed from real OldStar deliveries: every return/exchange
 *      pickup they've actually created (via the Bosta dashboard, not this
 *      API) used type code 30 ("Exchange") - including ones that read as
 *      plain returns from the notes. So this uses 30 for both `return` and
 *      `exchange` request types until/unless a dedicated return code turns
 *      up. Address orientation matches those real deliveries too:
 *      pickupAddress is the warehouse, dropOffAddress is the customer -
 *      i.e. the courier still starts at the warehouse and the
 *      pickup-the-old-item leg happens during that same customer visit,
 *      not as a separate reversed trip.
 *   2. `zoneId`/`districtId`: Bosta's addresses want its own internal zone
 *      and district IDs, not just a free-text city/address. RESOLVED for
 *      OldStar's actual warehouse - every one of OldStar's real outbound
 *      deliveries carries the same pickupAddress, so the IDs below are
 *      read directly from that live data (zone "ElShorouk", district
 *      "Zone 4 (ElShorouk)"), not guessed. Still overridable via env vars
 *      in case the registered pickup location ever changes.
 */
export async function createReturnPickup(input: {
  orderReference: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerAddress: string;
  city: string;
  notes?: string;
  packageDescription: string;
  itemsCount?: number;
}) {
  const [firstName, ...rest] = input.customerName.trim().split(/\s+/);
  const lastName = rest.join(" ") || "-";

  // Defaults are OldStar's real registered warehouse/pickup location,
  // read from live delivery data (see docstring above).
  const warehouseAddress = {
    city: process.env.BOSTA_WAREHOUSE_CITY || "Cairo",
    zoneId: process.env.BOSTA_WAREHOUSE_ZONE_ID || "BOGhk97qy3h", // "ElShorouk"
    districtId: process.env.BOSTA_WAREHOUSE_DISTRICT_ID || "DLrX9h0eFS0w7WDLoVlXp", // "Zone 4 (ElShorouk)"
    firstLine: process.env.BOSTA_WAREHOUSE_ADDRESS || "المنطقه الرابعه المجاوره التانيه",
    buildingNumber: process.env.BOSTA_WAREHOUSE_BUILDING || "83",
    floor: process.env.BOSTA_WAREHOUSE_FLOOR || "0",
  };

  const res = await bostaFetch("/deliveries", {
    method: "POST",
    body: JSON.stringify({
      type: 30, // "Exchange" - see note above
      specs: {
        packageType: "Parcel",
        size: "SMALL",
        packageDetails: {
          itemsCount: input.itemsCount ?? 1,
          description: input.packageDescription,
        },
      },
      notes: input.notes,
      cod: 0,
      pickupAddress: warehouseAddress,
      dropOffAddress: {
        city: input.city,
        firstLine: input.customerAddress,
      },
      businessReference: input.orderReference,
      allowToOpenPackage: true,
      receiver: {
        firstName: firstName || input.customerName,
        lastName,
        phone: input.customerPhone,
        email: input.customerEmail,
      },
    }),
  });
  return (await res.json()) as { success: boolean; data: { _id: string; trackingNumber: string } };
}
