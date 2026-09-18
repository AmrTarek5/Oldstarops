import { NextRequest, NextResponse } from "next/server";
import { getPortalSettings, updatePortalSettings } from "@/lib/portal";

export async function GET() {
  try {
    const settings = await getPortalSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  try {
    await updatePortalSettings({
      logo_url: body.logo_url || null,
      primary_color: body.primary_color,
      secondary_color: body.secondary_color,
      policy_text: body.policy_text || null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
