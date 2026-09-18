import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { email, name, isVip } = await request.json();
  if (typeof email !== "string" || typeof isVip !== "boolean") {
    return NextResponse.json({ error: "Missing email/isVip" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db.from("vip_customers").upsert(
    {
      customer_email: email,
      customer_name: name ?? null,
      is_vip: isVip,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "customer_email" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
