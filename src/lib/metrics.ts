import { supabaseAdmin } from "@/lib/supabase/server";
import {
  BOSTA_REMITTANCE_GRACE_DAYS,
  BULK_ORDER_MIN_ITEMS,
  FLEX_FEE_TITLE_PATTERNS,
  RETURN_PICKUP_FLAT_FEE_ESTIMATE,
  WHALE_SPEND_THRESHOLD,
} from "@/lib/config";
import type { DeliveryStatus, ReturnStatus } from "@/lib/types";

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export interface DeliveryFunnelStage {
  status: DeliveryStatus;
  count: number;
  codSum: number;
  bostaFeeSum: number;
}

const FUNNEL_STAGES: DeliveryStatus[] = [
  "new",
  "with_bosta",
  "out_for_delivery",
  "heading_back",
];

export async function getDeliveryFunnel() {
  const db = supabaseAdmin();
  const { data, error } = await db.from("v_delivery_funnel").select("*");
  if (error) throw error;

  const byStatus = new Map<string, { delivery_count: number; cod_sum: number; bosta_fee_sum: number }>();
  for (const row of data ?? []) {
    byStatus.set(row.status, row);
  }

  const stages: DeliveryFunnelStage[] = FUNNEL_STAGES.map((status) => {
    const row = byStatus.get(status);
    return {
      status,
      count: row?.delivery_count ?? 0,
      codSum: Number(row?.cod_sum ?? 0),
      bostaFeeSum: Number(row?.bosta_fee_sum ?? 0),
    };
  });

  const codInFlight = stages.reduce((sum, s) => sum + s.codSum, 0);
  const headingBackCod = stages.find((s) => s.status === "heading_back")?.codSum ?? 0;

  const delivered = byStatus.get("delivered");
  const failed = byStatus.get("failed");

  return {
    stages,
    codInFlight,
    headingBackCod,
    deliveredCount: delivered?.delivery_count ?? 0,
    failedCount: failed?.delivery_count ?? 0,
  };
}

export async function getInventoryAndCatalog() {
  const db = supabaseAdmin();
  const { data, error } = await db.from("v_inventory_totals").select("*").maybeSingle();
  if (error) throw error;

  return {
    totalUnits: Number(data?.total_units ?? 0),
    valueAtCost: Number(data?.value_at_cost ?? 0),
    valueAtRetail: Number(data?.value_at_retail ?? 0),
    variantsWithBarcode: Number(data?.variants_with_barcode ?? 0),
    variantsWithoutBarcode: Number(data?.variants_without_barcode ?? 0),
  };
}

export async function getWhales() {
  const db = supabaseAdmin();

  const [vipRes, topSpendRes] = await Promise.all([
    db.from("vip_customers").select("*").eq("is_vip", true),
    db
      .from("v_customer_spend")
      .select("*")
      .gte("total_spent", WHALE_SPEND_THRESHOLD)
      .order("total_spent", { ascending: false }),
  ]);
  if (vipRes.error) throw vipRes.error;
  if (topSpendRes.error) throw topSpendRes.error;

  const vipEmails = (vipRes.data ?? []).map((v) => v.customer_email);
  let vipSpendRes: { data: Array<{ customer_email: string; customer_name: string | null; total_spent: number; order_count: number }> } = { data: [] };
  if (vipEmails.length > 0) {
    const res = await db.from("v_customer_spend").select("*").in("customer_email", vipEmails);
    if (res.error) throw res.error;
    vipSpendRes = res;
  }

  const merged = new Map<string, { email: string; name: string | null; spend: number; orders: number }>();
  for (const row of topSpendRes.data ?? []) {
    merged.set(row.customer_email, {
      email: row.customer_email,
      name: row.customer_name,
      spend: Number(row.total_spent),
      orders: row.order_count,
    });
  }
  for (const row of vipSpendRes.data ?? []) {
    merged.set(row.customer_email, {
      email: row.customer_email,
      name: row.customer_name,
      spend: Number(row.total_spent),
      orders: row.order_count,
    });
  }
  // VIP-flagged customers with no order history yet still count as whales (revenue 0).
  for (const vip of vipRes.data ?? []) {
    if (!merged.has(vip.customer_email)) {
      merged.set(vip.customer_email, {
        email: vip.customer_email,
        name: vip.customer_name,
        spend: 0,
        orders: 0,
      });
    }
  }

  const whales = Array.from(merged.values()).sort((a, b) => b.spend - a.spend);
  const totalRevenue = whales.reduce((sum, w) => sum + w.spend, 0);

  return { count: whales.length, totalRevenue, whales };
}

export async function getBulkOrders(days = 30) {
  const db = supabaseAdmin();
  const { data, error, count } = await db
    .from("orders")
    .select("id, order_number, customer_name, item_count, total, shopify_created_at", {
      count: "exact",
    })
    .gte("item_count", BULK_ORDER_MIN_ITEMS)
    .gte("shopify_created_at", daysAgoIso(days))
    .order("shopify_created_at", { ascending: false });
  if (error) throw error;

  const totalValue = (data ?? []).reduce((sum, o) => sum + Number(o.total), 0);

  return { count: count ?? data?.length ?? 0, totalValue, orders: data ?? [] };
}

export async function getCashFlow(days = 30) {
  const db = supabaseAdmin();
  const since = daysAgoIso(days);
  const remittanceCutoff = daysAgoIso(BOSTA_REMITTANCE_GRACE_DAYS);

  const [deliveredRes, feesRes, returnsRes, codOrdersRes] = await Promise.all([
    db
      .from("deliveries")
      .select("cod_amount, delivered_at")
      .eq("status", "delivered")
      .gte("delivered_at", since),
    db.from("deliveries").select("bosta_fee").gte("created_at", since),
    db
      .from("return_requests")
      .select("pickup_fee, status, created_at")
      .in("status", ["accepted", "processing", "completed"])
      .gte("created_at", since),
    db
      .from("orders")
      .select("items")
      .eq("cod", true)
      .gte("shopify_created_at", since),
  ]);
  if (deliveredRes.error) throw deliveredRes.error;
  if (feesRes.error) throw feesRes.error;
  if (returnsRes.error) throw returnsRes.error;
  if (codOrdersRes.error) throw codOrdersRes.error;

  let codLive = 0;
  let codSettled = 0;
  for (const row of deliveredRes.data ?? []) {
    const amount = Number(row.cod_amount) || 0;
    if (row.delivered_at && row.delivered_at >= remittanceCutoff) {
      codLive += amount;
    } else {
      codSettled += amount;
    }
  }

  const bostaFeesOwed = (feesRes.data ?? []).reduce((sum, r) => sum + (Number(r.bosta_fee) || 0), 0);
  const returnHeadbackShippingCost = (returnsRes.data ?? []).reduce(
    (sum, r) => sum + (Number(r.pickup_fee) || RETURN_PICKUP_FLAT_FEE_ESTIMATE),
    0
  );
  const hiddenCostsTotal = bostaFeesOwed + returnHeadbackShippingCost;

  let codOrdersCount = 0;
  let flexFeePaidCount = 0;
  for (const order of codOrdersRes.data ?? []) {
    codOrdersCount += 1;
    const items = (order.items ?? []) as Array<{ title: string }>;
    const paid = items.some((item) =>
      FLEX_FEE_TITLE_PATTERNS.some((pattern) => pattern.test(item.title || ""))
    );
    if (paid) flexFeePaidCount += 1;
  }

  return {
    codLive,
    codSettled,
    codCollectedTotal: codLive + codSettled,
    bostaFeesOwed,
    returnHeadbackShippingCost,
    hiddenCostsTotal,
    flexFeePaidPct: codOrdersCount > 0 ? flexFeePaidCount / codOrdersCount : 0,
    codOrdersCount,
  };
}

export interface ReturnsFunnelCounts {
  under_review: number;
  accepted: number;
  processing: number;
  completed: number;
  rejected: number;
}

export async function getReturnsSummary(days = 30) {
  const db = supabaseAdmin();
  const since = daysAgoIso(days);

  const { data, error } = await db
    .from("return_requests")
    .select("status, type, reason, refund_amount, revenue_recovered, created_at")
    .gte("created_at", since);
  if (error) throw error;

  const rows = data ?? [];

  const funnel: ReturnsFunnelCounts = {
    under_review: 0,
    accepted: 0,
    processing: 0,
    completed: 0,
    rejected: 0,
  };
  let exchangeCount = 0;
  let refundCount = 0;
  let revenueRecovered = 0;
  const reasonCounts = new Map<string, number>();

  for (const row of rows) {
    const status = row.status as ReturnStatus;
    funnel[status] = (funnel[status] ?? 0) + 1;

    if (row.type === "exchange" && status === "completed") exchangeCount += 1;
    if (row.type === "return" && status === "completed") refundCount += 1;
    revenueRecovered += Number(row.revenue_recovered) || 0;

    reasonCounts.set(row.reason, (reasonCounts.get(row.reason) ?? 0) + 1);
  }

  const reasonBreakdown = Array.from(reasonCounts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  return {
    funnel,
    exchangeCount,
    refundCount,
    revenueRecovered,
    reasonBreakdown,
    totalRequests: rows.length,
  };
}
