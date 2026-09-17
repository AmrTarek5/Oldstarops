import { NextRequest, NextResponse } from "next/server";
import { checkAdminCredentials, createSessionToken, setSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  if (!checkAdminCredentials(email, password)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = await createSessionToken(email);
  await setSessionCookie(token);

  return NextResponse.json({ ok: true });
}
