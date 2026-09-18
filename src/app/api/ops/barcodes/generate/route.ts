import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { setVariantBarcode } from "@/lib/shopify";

async function generateOne(variantId: string) {
  const db = supabaseAdmin();

  const { data: existing, error: fetchError } = await db
    .from("inventory_snapshot")
    .select("barcode")
    .eq("variant_id", variantId)
    .single();
  if (fetchError) throw new Error(`Variant not found: ${fetchError.message}`);
  if (existing.barcode) throw new Error("Variant already has a barcode - not overwriting");

  const { data: barcodeData, error: rpcError } = await db.rpc("next_barcode");
  if (rpcError) throw new Error(`Barcode generation failed: ${rpcError.message}`);
  const barcode = barcodeData as string;

  await setVariantBarcode(`gid://shopify/ProductVariant/${variantId}`, barcode);

  const { error: updateError } = await db
    .from("inventory_snapshot")
    .update({ barcode })
    .eq("variant_id", variantId)
    .is("barcode", null);
  if (updateError) throw new Error(`Failed to save barcode locally: ${updateError.message}`);

  return barcode;
}

export async function POST(request: NextRequest) {
  const { variantId, variantIds } = await request.json();

  try {
    if (variantId) {
      const barcode = await generateOne(variantId);
      return NextResponse.json({ ok: true, barcode });
    }

    if (Array.isArray(variantIds)) {
      const results: Array<{ variantId: string; barcode?: string; error?: string }> = [];
      for (const id of variantIds) {
        try {
          const barcode = await generateOne(id);
          results.push({ variantId: id, barcode });
        } catch (err) {
          results.push({ variantId: id, error: err instanceof Error ? err.message : String(err) });
        }
      }
      return NextResponse.json({ ok: true, results });
    }

    return NextResponse.json({ error: "Provide variantId or variantIds" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}
