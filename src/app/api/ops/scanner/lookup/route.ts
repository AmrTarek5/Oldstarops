import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const barcode = request.nextUrl.searchParams.get("barcode")?.trim();
  if (!barcode) return NextResponse.json({ error: "Missing barcode" }, { status: 400 });

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("inventory_snapshot")
    .select("*")
    .or(`barcode.eq.${barcode},sku.eq.${barcode}`)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "No matching item found" }, { status: 404 });

  return NextResponse.json({ item: data });
}
