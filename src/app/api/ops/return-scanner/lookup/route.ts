import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  const db = supabaseAdmin();

  const { data: delivery } = await db
    .from("deliveries")
    .select("id, tracking_number, order_id, cod_amount, status, resolved_at")
    .eq("tracking_number", code)
    .eq("status", "failed")
    .is("resolved_at", null)
    .maybeSingle();

  if (delivery) {
    const { data: order } = delivery.order_id
      ? await db.from("orders").select("order_number, customer_name, items").eq("id", delivery.order_id).maybeSingle()
      : { data: null };
    return NextResponse.json({
      kind: "failed_delivery",
      deliveryId: delivery.id,
      trackingNumber: delivery.tracking_number,
      codAmount: delivery.cod_amount,
      orderNumber: order?.order_number ?? null,
      customerName: order?.customer_name ?? null,
      items: order?.items ?? [],
    });
  }

  const { data: returnRequest } = await db
    .from("return_requests")
    .select("id, order_number, customer_name, status, items, type")
    .eq("bosta_pickup_id", code)
    .in("status", ["accepted", "processing"])
    .maybeSingle();

  if (returnRequest) {
    return NextResponse.json({
      kind: "return_pickup",
      returnId: returnRequest.id,
      orderNumber: returnRequest.order_number,
      customerName: returnRequest.customer_name,
      status: returnRequest.status,
      type: returnRequest.type,
      items: returnRequest.items,
    });
  }

  return NextResponse.json({ error: "No matching failed delivery or return pickup found" }, { status: 404 });
}
