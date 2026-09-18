import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { variantId, delta } = await request.json();
  if (typeof variantId !== "string" || typeof delta !== "number") {
    return NextResponse.json({ error: "Missing variantId/delta" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: current, error: fetchError } = await db
    .from("inventory_snapshot")
    .select("stock_qty")
    .eq("variant_id", variantId)
    .single();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 404 });

  const newQty = Math.max(0, current.stock_qty + delta);
  const { data, error } = await db
    .from("inventory_snapshot")
    .update({ stock_qty: newQty })
    .eq("variant_id", variantId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ item: data });
}
