import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { fetchVariantsPage, idFromGid, type ShopifyVariantNode } from "@/lib/shopify";
import type { InventorySnapshotRow, SyncStateRow } from "@/lib/types";

export const maxDuration = 60;

const SYNC_KEY = "shopify_products";
const MAX_PAGES_PER_RUN = 5;

function mapVariant(node: ShopifyVariantNode): InventorySnapshotRow {
  return {
    variant_id: idFromGid(node.id),
    sku: node.sku,
    barcode: node.barcode,
    product_id: idFromGid(node.product.id),
    product_title: node.product.title,
    variant_title: node.title === "Default Title" ? null : node.title,
    stock_qty: node.inventoryQuantity ?? 0,
    cost: Number(node.inventoryItem.unitCost?.amount) || 0,
    retail_price: Number(node.price) || 0,
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

  let cursor = syncState?.cursor ?? undefined;
  let pagesFetched = 0;
  let variantsUpserted = 0;
  let nextCursor: string | null = null;

  try {
    do {
      const page = await fetchVariantsPage(cursor);
      pagesFetched += 1;

      if (page.variants.length > 0) {
        const rows = page.variants.map(mapVariant);
        const { error } = await db.from("inventory_snapshot").upsert(rows, {
          onConflict: "variant_id",
        });
        if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
        variantsUpserted += rows.length;
      }

      nextCursor = page.nextCursor;
      cursor = nextCursor ?? undefined;
    } while (nextCursor && pagesFetched < MAX_PAGES_PER_RUN);

    const sweepComplete = !nextCursor;

    await db.from("sync_state").upsert(
      {
        key: SYNC_KEY,
        cursor: sweepComplete ? null : nextCursor,
        last_synced_at: sweepComplete ? new Date().toISOString() : syncState?.last_synced_at ?? null,
        meta: {},
      },
      { onConflict: "key" }
    );

    return NextResponse.json({ ok: true, pagesFetched, variantsUpserted, sweepComplete });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
