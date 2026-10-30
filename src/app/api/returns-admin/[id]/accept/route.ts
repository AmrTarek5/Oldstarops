import { NextRequest, NextResponse } from "next/server";
import { acceptReturnRequest } from "@/lib/returns";
import { errorMessage } from "@/lib/error-message";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await acceptReturnRequest(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 400 });
  }
}
