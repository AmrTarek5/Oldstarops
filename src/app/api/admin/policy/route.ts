import { NextRequest, NextResponse } from "next/server";
import { getReturnPolicy, updateReturnPolicy } from "@/lib/policy";

export async function GET() {
  try {
    const policy = await getReturnPolicy();
    return NextResponse.json({ policy });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  try {
    await updateReturnPolicy({
      window_days: Number(body.window_days),
      final_sale_skus: body.final_sale_skus,
      allowed_reasons: body.allowed_reasons,
      blocked_reasons: body.blocked_reasons,
      auto_approve: Boolean(body.auto_approve),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
