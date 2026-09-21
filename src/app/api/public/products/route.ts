import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { InventorySnapshotRow } from "@/lib/types";

export interface PublicProductVariant {
  variantId: string;
  sku: string | null;
  variantTitle: string | null;
  options: Array<{ name: string; value: string }>;
  imageUrl: string | null;
  stockQty: number;
}

export interface PublicProduct {
  productId: string;
  productTitle: string;
  imageUrl: string | null;
  variants: PublicProductVariant[];
}

/** Feeds the returns portal's "what would you like instead?" picker with the live, in-stock catalog. */
export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("inventory_snapshot")
    .select("*")
    .gt("stock_qty", 0)
    .order("product_title", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as InventorySnapshotRow[];
  const byProduct = new Map<string, PublicProduct>();

  for (const row of rows) {
    const productId = row.product_id ?? row.variant_id;
    let product = byProduct.get(productId);
    if (!product) {
      product = { productId, productTitle: row.product_title, imageUrl: row.image_url, variants: [] };
      byProduct.set(productId, product);
    }
    product.variants.push({
      variantId: row.variant_id,
      sku: row.sku,
      variantTitle: row.variant_title,
      options: row.options ?? [],
      imageUrl: row.image_url,
      stockQty: row.stock_qty,
    });
  }

  return NextResponse.json({ products: Array.from(byProduct.values()) });
}
