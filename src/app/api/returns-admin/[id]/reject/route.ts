import { NextRequest, NextResponse } from "next/server";
import { rejectReturnRequest } from "@/lib/returns";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { notes } = await request.json().catch(() => ({ notes: undefined }));
  try {
    await rejectReturnRequest(id, notes);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
