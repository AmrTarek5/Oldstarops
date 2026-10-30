import { NextRequest, NextResponse } from "next/server";
import { restockFailedDelivery } from "@/lib/ops";
import { errorMessage } from "@/lib/error-message";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await restockFailedDelivery(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: errorMessage(err) },
      { status: 400 }
    );
  }
}
