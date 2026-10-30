/**
 * Minimal Bosta API client for the MCP server.
 *
 * Auth is `Authorization: <api key>` with NO "Bearer" prefix - confirmed by
 * Bosta support against a live key, despite docs.bosta.co labeling the
 * endpoint "Bearer Auth".
 *
 * Pagination: `/deliveries/search` silently ignores `page`/`limit` in the
 * query string - they must be sent in the JSON body, where Bosta enforces a
 * real server-side cap of 200 records per request (confirmed empirically;
 * requesting limit:500 in the body returns limit:200 in the response).
 */

const BASE_URL = process.env.BOSTA_API_BASE_URL || "https://app.bosta.co/api/v2";

function headers() {
  const key = process.env.BOSTA_API_KEY;
  if (!key) throw new Error("Missing BOSTA_API_KEY env var");
  return {
    Authorization: key,
    "Content-Type": "application/json",
  };
}

export interface BostaDelivery {
  _id: string;
  trackingNumber: string;
  state: { code: number; value: string; deliveryTime?: string };
  type?: { code: number; value: string };
  cod?: number;
  businessReference?: string;
  uniqueBusinessReference?: string;
  receiver?: { firstName?: string; lastName?: string; phone?: string };
  updatedAt: string;
  createdAt?: string;
  flexShippingInfo?: {
    status?: string;
    isAmountCollected?: boolean;
    collectedAmount?: number;
    amountToBeCollected?: number;
  };
  paymentInfo?: { amount?: number; capturedStatus?: string };
  cashoutInfo?: { expectedCashoutDate?: string };
}

export interface DeliverySearchFilter {
  trackingNumbers?: string[];
  mobilePhones?: string[];
  businessReference?: string;
  stateCodes?: number[];
  page?: number;
  limit?: number;
}

export async function searchDeliveries(filter: DeliverySearchFilter) {
  const limit = Math.min(filter.limit ?? 20, 200);
  const page = filter.page ?? 1;

  const res = await fetch(`${BASE_URL}/deliveries/search`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      page,
      limit,
      ...(filter.trackingNumbers ? { trackingNumbers: filter.trackingNumbers } : {}),
      ...(filter.mobilePhones ? { mobilePhones: filter.mobilePhones } : {}),
      ...(filter.businessReference ? { businessReference: filter.businessReference } : {}),
      ...(filter.stateCodes ? { stateCodes: filter.stateCodes } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`Bosta API error ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as {
    success: boolean;
    data: { deliveries: BostaDelivery[]; page?: number; limit?: number };
  };

  return json.data?.deliveries ?? [];
}

export function summarizeDelivery(d: BostaDelivery) {
  const collected =
    (d.flexShippingInfo?.isAmountCollected ? d.flexShippingInfo.collectedAmount : undefined) ??
    (d.paymentInfo?.capturedStatus === "SUCCEEDED" ? d.paymentInfo.amount : undefined) ??
    (Number(d.cod) || 0);

  return {
    id: d._id,
    trackingNumber: d.trackingNumber,
    state: d.state?.value,
    stateCode: d.state?.code,
    type: d.type?.value,
    deliveredAt: d.state?.deliveryTime ?? null,
    codDue: Number(d.cod) || 0,
    collectedAmount: collected,
    expectedCashoutDate: d.cashoutInfo?.expectedCashoutDate ?? null,
    receiverName: [d.receiver?.firstName, d.receiver?.lastName].filter(Boolean).join(" ") || null,
    receiverPhone: d.receiver?.phone ?? null,
    businessReference: d.businessReference ?? d.uniqueBusinessReference ?? null,
    updatedAt: d.updatedAt,
  };
}
