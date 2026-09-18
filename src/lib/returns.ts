import { supabaseAdmin } from "@/lib/supabase/server";
import { createReturnPickup } from "@/lib/bosta";
import { evaluateReturn, getReturnPolicy } from "@/lib/policy";
import { reviewReturnPhotos } from "@/lib/ai-review";
import type { OrderLineItem, OrderRow, ReturnRequestRow, ReturnType } from "@/lib/types";

export async function lookupOrderForPortal(orderNumber: string, email: string) {
  const db = supabaseAdmin();
  const cleanedNumber = orderNumber.trim().replace(/^#/, "");

  const { data, error } = await db
    .from("orders")
    .select("*")
    .or(`order_number.eq.${cleanedNumber},order_number.eq.#${cleanedNumber}`)
    .ilike("customer_email", email.trim())
    .maybeSingle();
  if (error) throw error;
  return data as OrderRow | null;
}

export interface SubmitReturnInput {
  order: OrderRow;
  type: ReturnType;
  reason: string;
  notes?: string;
  items: OrderLineItem[];
  photoUrls: string[];
}

export async function submitReturnRequest(input: SubmitReturnInput) {
  const db = supabaseAdmin();
  const policy = await getReturnPolicy();

  const decision = evaluateReturn({
    policy,
    orderCreatedAt: input.order.shopify_created_at,
    reason: input.reason,
    skus: input.items.map((i) => i.sku),
  });

  const aiReview = await reviewReturnPhotos({
    photoUrls: input.photoUrls,
    itemTitle: input.items.map((i) => i.title).join(", "),
    reason: input.reason,
    notes: input.notes,
  });

  const status = decision.decision === "reject" ? "rejected" : decision.decision === "accept" ? "accepted" : "under_review";

  const { data: created, error } = await db
    .from("return_requests")
    .insert({
      order_id: input.order.id,
      order_number: input.order.order_number,
      customer_name: input.order.customer_name,
      customer_email: input.order.customer_email,
      type: input.type,
      reason: input.reason,
      notes:
        decision.decision === "reject"
          ? [input.notes, `Auto-rejected: ${decision.message}`].filter(Boolean).join(" | ")
          : input.notes ?? null,
      status,
      items: input.items,
      photo_urls: input.photoUrls,
      ai_review: aiReview,
    })
    .select()
    .single();
  if (error) throw error;

  const returnRow = created as ReturnRequestRow;

  if (status === "accepted") {
    await createPickupForReturn(returnRow.id).catch(() => undefined);
  }

  return { returnRequest: returnRow, decision };
}

/** Creates (or retries) the Bosta reverse-pickup for an accepted return. Never throws to the caller. */
export async function createPickupForReturn(returnId: string) {
  const db = supabaseAdmin();
  const { data: ret, error } = await db.from("return_requests").select("*").eq("id", returnId).single();
  if (error) throw error;
  const returnRow = ret as ReturnRequestRow;
  if (returnRow.bosta_pickup_id) return returnRow; // already created

  const { data: order, error: orderError } = await db
    .from("orders")
    .select("*")
    .eq("id", returnRow.order_id)
    .single();
  if (orderError) throw orderError;
  const orderRow = order as OrderRow;

  try {
    const pickup = await createReturnPickup({
      orderReference: orderRow.order_number,
      customerName: orderRow.customer_name ?? "Customer",
      customerPhone: orderRow.customer_phone ?? "",
      customerAddress: orderRow.shipping_address ?? "",
      city: orderRow.shipping_city ?? "",
      packageDescription: returnRow.items.map((i) => `${i.quantity}x ${i.title}`).join(", "),
      notes: returnRow.notes ?? undefined,
    });

    const { data: updated, error: updateError } = await db
      .from("return_requests")
      .update({ bosta_pickup_id: pickup._id })
      .eq("id", returnId)
      .select()
      .single();
    if (updateError) throw updateError;
    return updated as ReturnRequestRow;
  } catch (err) {
    // Leave bosta_pickup_id null so the processing queue can show "pickup not
    // created yet" and offer a retry, rather than failing the whole accept.
    console.error(`Bosta pickup creation failed for return ${returnId}:`, err);
    return returnRow;
  }
}

export async function acceptReturnRequest(returnId: string) {
  const db = supabaseAdmin();
  const { error } = await db
    .from("return_requests")
    .update({ status: "accepted" })
    .eq("id", returnId);
  if (error) throw error;
  return createPickupForReturn(returnId);
}

export async function rejectReturnRequest(returnId: string, notes?: string) {
  const db = supabaseAdmin();
  const { error } = await db
    .from("return_requests")
    .update({ status: "rejected", notes: notes ?? null })
    .eq("id", returnId);
  if (error) throw error;
}

export async function moveReturnToProcessing(returnId: string) {
  const db = supabaseAdmin();
  const { error } = await db
    .from("return_requests")
    .update({ status: "processing" })
    .eq("id", returnId);
  if (error) throw error;
}

export async function completeReturn(
  returnId: string,
  input: { refundAmount?: number; revenueRecovered?: number }
) {
  const db = supabaseAdmin();
  const { error } = await db
    .from("return_requests")
    .update({
      status: "completed",
      refund_amount: input.refundAmount ?? null,
      revenue_recovered: input.revenueRecovered ?? null,
    })
    .eq("id", returnId);
  if (error) throw error;
}

export interface MostReturnedProduct {
  variantId: string | null;
  title: string;
  returnCount: number;
  unitsReturned: number;
}

export async function getMostReturnedProducts(days: number, limit = 10) {
  const db = supabaseAdmin();
  let query = db.from("v_return_line_items").select("variant_id, title, quantity, return_id, created_at");
  if (days > 0) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    query = query.gte("created_at", since.toISOString());
  }
  const { data, error } = await query;
  if (error) throw error;

  const byVariant = new Map<string, MostReturnedProduct>();
  for (const row of data ?? []) {
    const key = row.variant_id ?? row.title;
    const existing = byVariant.get(key) ?? {
      variantId: row.variant_id,
      title: row.title,
      returnCount: 0,
      unitsReturned: 0,
    };
    existing.returnCount += 1;
    existing.unitsReturned += row.quantity;
    byVariant.set(key, existing);
  }

  return Array.from(byVariant.values())
    .sort((a, b) => b.unitsReturned - a.unitsReturned)
    .slice(0, limit);
}

export async function getReturnRequests(statuses?: string[]) {
  const db = supabaseAdmin();
  let query = db.from("return_requests").select("*").order("created_at", { ascending: false });
  if (statuses && statuses.length > 0) query = query.in("status", statuses);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ReturnRequestRow[];
}
