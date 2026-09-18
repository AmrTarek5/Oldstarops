import { supabaseAdmin } from "@/lib/supabase/server";
import type { OrderLineItem } from "@/lib/types";

export interface FailedDeliveryRow {
  deliveryId: string;
  trackingNumber: string;
  orderId: string | null;
  orderNumber: string | null;
  customerName: string | null;
  customerPhone: string | null;
  items: OrderLineItem[];
  codAmount: number;
  updatedAt: string;
}

/** Failed deliveries that haven't been restocked or cleared yet. */
export async function getFailedDeliveries() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("deliveries")
    .select("id, tracking_number, order_id, cod_amount, updated_at")
    .eq("status", "failed")
    .is("resolved_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw error;

  const orderIds = [...new Set((data ?? []).map((d) => d.order_id).filter(Boolean))] as string[];
  const ordersById = new Map<string, { order_number: string; customer_name: string | null; items: OrderLineItem[] }>();
  if (orderIds.length > 0) {
    const { data: orders, error: ordersError } = await db
      .from("orders")
      .select("id, order_number, customer_name, items")
      .in("id", orderIds);
    if (ordersError) throw ordersError;
    for (const o of orders ?? []) {
      ordersById.set(o.id, { order_number: o.order_number, customer_name: o.customer_name, items: o.items });
    }
  }

  const rows: FailedDeliveryRow[] = (data ?? []).map((d) => {
    const order = d.order_id ? ordersById.get(d.order_id) : undefined;
    return {
      deliveryId: d.id,
      trackingNumber: d.tracking_number,
      orderId: d.order_id,
      orderNumber: order?.order_number ?? null,
      customerName: order?.customer_name ?? null,
      customerPhone: null,
      items: order?.items ?? [],
      codAmount: Number(d.cod_amount) || 0,
      updatedAt: d.updated_at,
    };
  });

  return rows;
}

/** Restocks a failed delivery's items back into inventory_snapshot and marks it resolved. */
export async function restockFailedDelivery(deliveryId: string) {
  const db = supabaseAdmin();

  const { data: delivery, error } = await db
    .from("deliveries")
    .select("id, order_id, resolved_at")
    .eq("id", deliveryId)
    .single();
  if (error) throw error;
  if (delivery.resolved_at) throw new Error("Delivery already resolved");

  if (delivery.order_id) {
    const { data: order, error: orderError } = await db
      .from("orders")
      .select("items")
      .eq("id", delivery.order_id)
      .single();
    if (orderError) throw orderError;

    const items = (order?.items ?? []) as OrderLineItem[];
    for (const item of items) {
      if (!item.variant_id) continue;
      const { data: inv } = await db
        .from("inventory_snapshot")
        .select("stock_qty")
        .eq("variant_id", item.variant_id)
        .maybeSingle();
      if (inv) {
        await db
          .from("inventory_snapshot")
          .update({ stock_qty: inv.stock_qty + item.quantity })
          .eq("variant_id", item.variant_id);
      }
    }
  }

  await db
    .from("deliveries")
    .update({ resolution: "restocked", resolved_at: new Date().toISOString() })
    .eq("id", deliveryId);
}

export async function clearFailedDelivery(deliveryId: string) {
  const db = supabaseAdmin();
  await db
    .from("deliveries")
    .update({ resolution: "cleared", resolved_at: new Date().toISOString() })
    .eq("id", deliveryId);
}

const IN_TRANSIT_STATUSES = ["with_bosta", "out_for_delivery", "heading_back"] as const;

export interface InTransitRow {
  deliveryId: string;
  trackingNumber: string;
  status: string;
  orderNumber: string | null;
  customerName: string | null;
  codAmount: number;
  stockValueAtCost: number;
  stockValueAtRetail: number;
}

export async function getInTransitStock() {
  const db = supabaseAdmin();
  const { data: deliveries, error } = await db
    .from("deliveries")
    .select("id, tracking_number, status, order_id, cod_amount")
    .in("status", IN_TRANSIT_STATUSES as unknown as string[]);
  if (error) throw error;

  const orderIds = [...new Set((deliveries ?? []).map((d) => d.order_id).filter(Boolean))] as string[];
  const ordersById = new Map<string, { order_number: string; customer_name: string | null; items: OrderLineItem[] }>();
  if (orderIds.length > 0) {
    const { data: orders, error: ordersError } = await db
      .from("orders")
      .select("id, order_number, customer_name, items")
      .in("id", orderIds);
    if (ordersError) throw ordersError;
    for (const o of orders ?? []) {
      ordersById.set(o.id, { order_number: o.order_number, customer_name: o.customer_name, items: o.items });
    }
  }

  const variantIds = new Set<string>();
  for (const order of ordersById.values()) {
    for (const item of order.items) if (item.variant_id) variantIds.add(item.variant_id);
  }
  const costByVariant = new Map<string, { cost: number; retail: number }>();
  if (variantIds.size > 0) {
    const { data: inv, error: invError } = await db
      .from("inventory_snapshot")
      .select("variant_id, cost, retail_price")
      .in("variant_id", [...variantIds]);
    if (invError) throw invError;
    for (const row of inv ?? []) {
      costByVariant.set(row.variant_id, { cost: Number(row.cost), retail: Number(row.retail_price) });
    }
  }

  const rows: InTransitRow[] = (deliveries ?? []).map((d) => {
    const order = d.order_id ? ordersById.get(d.order_id) : undefined;
    let stockValueAtCost = 0;
    let stockValueAtRetail = 0;
    for (const item of order?.items ?? []) {
      const costInfo = item.variant_id ? costByVariant.get(item.variant_id) : undefined;
      stockValueAtCost += (costInfo?.cost ?? 0) * item.quantity;
      stockValueAtRetail += (costInfo?.retail ?? item.price) * item.quantity;
    }
    return {
      deliveryId: d.id,
      trackingNumber: d.tracking_number,
      status: d.status,
      orderNumber: order?.order_number ?? null,
      customerName: order?.customer_name ?? null,
      codAmount: Number(d.cod_amount) || 0,
      stockValueAtCost,
      stockValueAtRetail,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      codAmount: acc.codAmount + r.codAmount,
      stockValueAtCost: acc.stockValueAtCost + r.stockValueAtCost,
      stockValueAtRetail: acc.stockValueAtRetail + r.stockValueAtRetail,
    }),
    { codAmount: 0, stockValueAtCost: 0, stockValueAtRetail: 0 }
  );

  return { rows, totals };
}
