import { NextRequest, NextResponse } from "next/server";
import { completeReturn } from "@/lib/returns";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { refundAmount, revenueRecovered } = await request.json();
  try {
    await completeReturn(id, {
      refundAmount: typeof refundAmount === "number" ? refundAmount : undefined,
      revenueRecovered: typeof revenueRecovered === "number" ? revenueRecovered : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
