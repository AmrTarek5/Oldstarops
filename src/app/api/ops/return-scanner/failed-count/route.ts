import { NextResponse } from "next/server";
import { getFailedDeliveryCount } from "@/lib/ops";
import { errorMessage } from "@/lib/error-message";

export async function GET() {
  try {
    const count = await getFailedDeliveryCount();
    return NextResponse.json({ count });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
