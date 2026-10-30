import { NextRequest, NextResponse } from "next/server";
import { createPickupForReturn } from "@/lib/returns";
import { errorMessage } from "@/lib/error-message";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await createPickupForReturn(id);
    return NextResponse.json({ ok: true, pickupCreated: Boolean(result.bosta_pickup_id) });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 400 });
  }
}
