import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { fetchOrdersPage, isCodOrder, type ShopifyOrder } from "@/lib/shopify";
import type { OrderRow, OrderLineItem, SyncStateRow } from "@/lib/types";

export const maxDuration = 60; // Node runtime cap on Vercel Hobby; keep pages bounded below it.

const SYNC_KEY = "shopify_orders";
// Keep each invocation short: if there's more to fetch we save the cursor
// and pick up where we left off on the next cron trigger, rather than
// risking a function timeout mid-sweep.
const MAX_PAGES_PER_RUN = 5;
const PAGE_SIZE = 100;

function mapOrder(order: ShopifyOrder): OrderRow {
  const items: OrderLineItem[] = order.line_items.map((li) => ({
    variant_id: li.variant_id ? String(li.variant_id) : null,
    sku: li.sku,
    title: li.title,
    quantity: li.quantity,
    price: Number(li.price) || 0,
  }));

  const customerName = order.customer
    ? [order.customer.first_name, order.customer.last_name].filter(Boolean).join(" ") || null
    : null;

  return {
    id: String(order.id),
    order_number: order.name || String(order.order_number),
    customer_id: order.customer ? String(order.customer.id) : null,
    customer_name: customerName,
    customer_email: order.customer?.email ?? null,
    items,
    item_count: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: Number(order.subtotal_price) || 0,
    shipping_charged: Number(order.total_shipping_price_set?.shop_money.amount) || 0,
    total: Number(order.total_price) || 0,
    cod: isCodOrder(order),
    financial_status: order.financial_status,
    fulfillment_status: order.fulfillment_status,
    tags: order.tags ? order.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    currency: order.currency,
    shopify_created_at: order.created_at,
    raw: order as unknown as Record<string, unknown>,
    created_at: order.created_at,
    updated_at: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const authError = requireCronSecret(request);
  if (authError) return authError;

  const db = supabaseAdmin();

  const { data: syncStateRaw } = await db
    .from("sync_state")
    .select("*")
    .eq("key", SYNC_KEY)
    .maybeSingle();
  const syncState = syncStateRaw as SyncStateRow | null;

  const resuming = Boolean(syncState?.cursor);
  const sweepStartedAt =
    (resuming && (syncState?.meta?.sweep_started_at as string | undefined)) ||
    new Date().toISOString();

  let pageInfo = syncState?.cursor ?? undefined;
  const updatedAtMin = syncState?.last_synced_at ?? undefined;

  let pagesFetched = 0;
  let ordersUpserted = 0;
  let nextPageInfo: string | null = null;

  try {
    do {
      const page = await fetchOrdersPage({
        pageInfo,
        updatedAtMin: pageInfo ? undefined : updatedAtMin,
        limit: PAGE_SIZE,
      });
      pagesFetched += 1;

      if (page.orders.length > 0) {
        const rows = page.orders.map(mapOrder);
        const { error } = await db.from("orders").upsert(rows, { onConflict: "id" });
        if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
        ordersUpserted += rows.length;
      }

      nextPageInfo = page.nextPageInfo;
      pageInfo = nextPageInfo ?? undefined;
    } while (nextPageInfo && pagesFetched < MAX_PAGES_PER_RUN);

    const sweepComplete = !nextPageInfo;

    await db.from("sync_state").upsert(
      {
        key: SYNC_KEY,
        cursor: sweepComplete ? null : nextPageInfo,
        last_synced_at: sweepComplete ? sweepStartedAt : syncState?.last_synced_at ?? null,
        meta: sweepComplete ? {} : { sweep_started_at: sweepStartedAt },
      },
      { onConflict: "key" }
    );

    return NextResponse.json({
      ok: true,
      pagesFetched,
      ordersUpserted,
      sweepComplete,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
