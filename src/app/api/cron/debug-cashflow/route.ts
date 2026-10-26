import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export const maxDuration = 60;

// Temporary diagnostic endpoint - dumps what's actually in the deliveries
// table so we can see why the cash-flow dashboard numbers look wrong,
// instead of guessing. Safe to delete once the real issue is found.
export async function GET(request: NextRequest) {
  const authError = requireCronSecret(request);
  if (authError) return authError;

  const db = supabaseAdmin();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString();
  const now = new Date().toISOString();

  const { data: allDeliveries, error: allErr } = await db
    .from("deliveries")
    .select("id, status, cod_amount, delivered_at, created_at");
  if (allErr) return NextResponse.json({ error: allErr.message }, { status: 500 });

  const statusCounts: Record<string, number> = {};
  for (const d of allDeliveries ?? []) {
    statusCounts[d.status] = (statusCounts[d.status] ?? 0) + 1;
  }

  const { data: delivered, error: delErr } = await db
    .from("deliveries")
    .select("id, cod_amount, delivered_at, raw")
    .eq("status", "delivered")
    .gte("delivered_at", sinceIso);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  let withFlexShipping = 0;
  let withPaymentInfo = 0;
  let withCashoutInfo = 0;
  let withExpectedCashoutDate = 0;
  let settledCount = 0;
  let codAmountSum = 0;
  let collectedSum = 0;
  let settledSum = 0;
  let liveSum = 0;
  const samples: unknown[] = [];

  for (const row of delivered ?? []) {
    const raw = (row.raw ?? {}) as {
      flexShippingInfo?: { isAmountCollected?: boolean; collectedAmount?: number };
      paymentInfo?: { amount?: number; capturedStatus?: string };
      cashoutInfo?: { expectedCashoutDate?: string };
    };
    if (raw.flexShippingInfo) withFlexShipping += 1;
    if (raw.paymentInfo) withPaymentInfo += 1;
    if (raw.cashoutInfo) withCashoutInfo += 1;
    if (raw.cashoutInfo?.expectedCashoutDate) withExpectedCashoutDate += 1;

    const collected =
      (raw.flexShippingInfo?.isAmountCollected ? raw.flexShippingInfo.collectedAmount : undefined) ??
      (raw.paymentInfo?.capturedStatus === "SUCCEEDED" ? raw.paymentInfo.amount : undefined) ??
      (Number(row.cod_amount) || 0);

    const expectedCashout = raw.cashoutInfo?.expectedCashoutDate;
    const alreadySettled = Boolean(expectedCashout && expectedCashout <= now);
    if (alreadySettled) {
      settledCount += 1;
      settledSum += collected;
    } else {
      liveSum += collected;
    }

    codAmountSum += Number(row.cod_amount) || 0;
    collectedSum += collected;

    if (samples.length < 5) {
      samples.push({
        id: row.id,
        cod_amount: row.cod_amount,
        delivered_at: row.delivered_at,
        flexShippingInfo: raw.flexShippingInfo ?? null,
        paymentInfo: raw.paymentInfo ?? null,
        cashoutInfo: raw.cashoutInfo ?? null,
      });
    }
  }

  // Same collected/settled split, but across ALL delivered deliveries ever
  // synced (no 30-day window) - this is the number that's actually
  // comparable to Bosta's own "Total Balance" figure, which is a running
  // balance, not a monthly metric.
  const { data: allDelivered, error: allDelErr } = await db
    .from("deliveries")
    .select("id, cod_amount, raw")
    .eq("status", "delivered");
  if (allDelErr) return NextResponse.json({ error: allDelErr.message }, { status: 500 });

  let allTimeLive = 0;
  let allTimeSettled = 0;
  for (const row of allDelivered ?? []) {
    const raw = (row.raw ?? {}) as {
      flexShippingInfo?: { isAmountCollected?: boolean; collectedAmount?: number };
      paymentInfo?: { amount?: number; capturedStatus?: string };
      cashoutInfo?: { expectedCashoutDate?: string };
    };
    const collected =
      (raw.flexShippingInfo?.isAmountCollected ? raw.flexShippingInfo.collectedAmount : undefined) ??
      (raw.paymentInfo?.capturedStatus === "SUCCEEDED" ? raw.paymentInfo.amount : undefined) ??
      (Number(row.cod_amount) || 0);
    const expectedCashout = raw.cashoutInfo?.expectedCashoutDate;
    const alreadySettled = Boolean(expectedCashout && expectedCashout <= now);
    if (alreadySettled) allTimeSettled += collected;
    else allTimeLive += collected;
  }

  // v_cash_balance (if the 0005 migration has been applied) aggregates in
  // Postgres, so it isn't subject to the 1000-row cap that allTimeLive/
  // allTimeSettled above are vulnerable to - include it for comparison.
  const { data: viewBalance, error: viewErr } = await db
    .from("v_cash_balance")
    .select("bucket, delivery_count, total_collected");

  return NextResponse.json({
    statusCountsAllTime: statusCounts,
    deliveredLast30Days: delivered?.length ?? 0,
    withFlexShipping,
    withPaymentInfo,
    withCashoutInfo,
    withExpectedCashoutDate,
    settledCount,
    codAmountSum,
    collectedSum,
    settledSum,
    liveSum,
    allTimeDeliveredCount: allDelivered?.length ?? 0,
    allTimeLive,
    allTimeSettled,
    note: "allTimeLive/allTimeSettled above are capped at 1000 rows (PostgREST default) and understate the real total - v_cash_balance below is the correct, uncapped figure",
    v_cash_balance: viewErr ? { error: viewErr.message } : viewBalance,
    samples,
  });
}
