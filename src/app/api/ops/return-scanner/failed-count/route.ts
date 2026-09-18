import { NextResponse } from "next/server";
import { getFailedDeliveryCount } from "@/lib/ops";

export async function GET() {
  try {
    const count = await getFailedDeliveryCount();
    return NextResponse.json({ count });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
