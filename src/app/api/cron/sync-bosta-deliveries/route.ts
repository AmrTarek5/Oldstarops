import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { fetchDeliveriesPage, mapBostaState, type BostaDelivery } from "@/lib/bosta";
import type { DeliveryRow, SyncStateRow } from "@/lib/types";

export const maxDuration = 60;

const SYNC_KEY = "bosta_deliveries";
const MAX_PAGES_PER_RUN = 5;

async function resolveOrderId(
  db: ReturnType<typeof supabaseAdmin>,
  orderReference: string | undefined
) {
  if (!orderReference) return null;
  const cleaned = orderReference.replace(/^#/, "");

  const byId = await db.from("orders").select("id").eq("id", cleaned).maybeSingle();
  if (byId.data) return byId.data.id as string;

  const byNumber = await db
    .from("orders")
    .select("id")
    .or(`order_number.eq.${cleaned},order_number.eq.#${cleaned}`)
    .maybeSingle();
  return byNumber.data?.id ?? null;
}

function mapDelivery(d: BostaDelivery, orderId: string | null): DeliveryRow {
  return {
    id: d._id,
    order_id: orderId,
    tracking_number: d.trackingNumber,
    status: mapBostaState(d.state),
    cod_amount: Number(d.cod) || 0,
    bosta_fee: Number(d.fees) || 0,
    delivered_at: d.deliveredAt ?? null,
    raw: d as unknown as Record<string, unknown>,
    created_at: d.updatedAt,
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
  const updatedAfter = syncState?.cursor ? undefined : syncState?.last_synced_at ?? undefined;

  let pagesFetched = 0;
  let deliveriesUpserted = 0;
  let hasMore = false;

  try {
    do {
      const result = await fetchDeliveriesPage({ page, updatedAfter, limit: 100 });
      pagesFetched += 1;

      if (result.deliveries.length > 0) {
        const rows: DeliveryRow[] = [];
        for (const d of result.deliveries) {
          const orderId = await resolveOrderId(db, d.orderReference);
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
