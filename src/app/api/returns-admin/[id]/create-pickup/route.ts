import { NextRequest, NextResponse } from "next/server";
import { createPickupForReturn } from "@/lib/returns";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await createPickupForReturn(id);
    return NextResponse.json({ ok: true, pickupCreated: Boolean(result.bosta_pickup_id) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
