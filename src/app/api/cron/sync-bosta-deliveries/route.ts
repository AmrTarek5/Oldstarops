import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { fetchDeliveriesPage, mapBostaState, extractBostaFee, type BostaDelivery } from "@/lib/bosta";
import type { DeliveryRow, SyncStateRow } from "@/lib/types";

export const maxDuration = 60;

const SYNC_KEY = "bosta_deliveries";
const MAX_PAGES_PER_RUN = 5;

async function resolveOrderId(db: ReturnType<typeof supabaseAdmin>, delivery: BostaDelivery) {
  // Prefer shopifyInfo.orderId - a direct match to orders.id when the
  // delivery was created from a Shopify order.
  if (delivery.shopifyInfo?.orderId) {
    const byId = await db
      .from("orders")
      .select("id")
      .eq("id", delivery.shopifyInfo.orderId)
      .maybeSingle();
    if (byId.data) return byId.data.id as string;
  }

  // Fall back to businessReference, formatted "<shopify-store-handle>:#<order number>"
  // - the only link available for deliveries created manually in the Bosta
  // dashboard (e.g. exchange pickups), which have no shopifyInfo.
  const ref = delivery.businessReference ?? delivery.uniqueBusinessReference;
  if (!ref) return null;
  const cleaned = ref.split(":").pop()?.replace(/^#/, "");
  if (!cleaned) return null;

  const byNumber = await db
    .from("orders")
    .select("id")
    .or(`order_number.eq.${cleaned},order_number.eq.#${cleaned}`)
    .maybeSingle();
  return byNumber.data?.id ?? null;
}

function mapDelivery(d: BostaDelivery, orderId: string | null): Omit<DeliveryRow, "resolution" | "resolved_at"> {
  return {
    id: d._id,
    order_id: orderId,
    tracking_number: d.trackingNumber,
    status: mapBostaState(d),
    cod_amount: Number(d.cod) || 0,
    bosta_fee: extractBostaFee(d.pricing),
    delivered_at: d.state.deliveryTime ?? null,
    raw: d as unknown as Record<string, unknown>,
    created_at: new Date(d.updatedAt).toISOString(),
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

  const sweepStartedAt =
    (syncState?.meta?.sweep_started_at as string | undefined) || new Date().toISOString();
  let page = (syncState?.meta?.page as number | undefined) ?? 1;

  let pagesFetched = 0;
  let deliveriesUpserted = 0;
  let hasMore = false;

  try {
    do {
      // No confirmed date-range filter on Bosta's search endpoint, so each
      // sweep re-pages through everything - upserts de-dupe by id, so this
      // is just less efficient than a true incremental sync, not incorrect.
      const result = await fetchDeliveriesPage({ page, limit: 100 });
      pagesFetched += 1;

      if (result.deliveries.length > 0) {
        const rows: Omit<DeliveryRow, "resolution" | "resolved_at">[] = [];
        for (const d of result.deliveries) {
          const orderId = await resolveOrderId(db, d);
          rows.push(mapDelivery(d, orderId));
        }
        const { error } = await db.from("deliveries").upsert(rows, { onConflict: "id" });
        if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
        deliveriesUpserted += rows.length;
      }

      hasMore = Boolean(result.hasMore);
      page += 1;
    } while (hasMore && pagesFetched < MAX_PAGES_PER_RUN);

    const sweepComplete = !hasMore;

    await db.from("sync_state").upsert(
      {
        key: SYNC_KEY,
        cursor: sweepComplete ? null : "in_progress",
        last_synced_at: sweepComplete ? sweepStartedAt : syncState?.last_synced_at ?? null,
        meta: sweepComplete ? {} : { sweep_started_at: sweepStartedAt, page },
      },
      { onConflict: "key" }
    );

    return NextResponse.json({ ok: true, pagesFetched, deliveriesUpserted, sweepComplete });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
