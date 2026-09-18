import { supabaseAdmin } from "@/lib/supabase/server";
import type { ReturnPolicyRow } from "@/lib/types";

export async function getReturnPolicy(): Promise<ReturnPolicyRow> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("return_policy").select("*").eq("id", 1).single();
  if (error) throw error;
  return data as ReturnPolicyRow;
}

export async function updateReturnPolicy(patch: Partial<Omit<ReturnPolicyRow, "id" | "updated_at">>) {
  const db = supabaseAdmin();
  const { error } = await db
    .from("return_policy")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw error;
}

export type PolicyDecision =
  | { decision: "reject"; message: string }
  | { decision: "accept" }
  | { decision: "review" };

/**
 * Applies the return_policy rules to a request. This never has the final
 * say when the outcome is "review" - a human decides in the requests inbox.
 * "reject" and "accept" are only returned when auto_approve is on and the
 * request unambiguously matches a hard rule (window, final-sale, blocked
 * reason).
 */
export function evaluateReturn(params: {
  policy: ReturnPolicyRow;
  orderCreatedAt: string;
  reason: string;
  skus: Array<string | null>;
}): PolicyDecision {
  const { policy, orderCreatedAt, reason, skus } = params;

  const daysSinceOrder =
    (Date.now() - new Date(orderCreatedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceOrder > policy.window_days) {
    return { decision: "reject", message: `Outside the ${policy.window_days}-day return window` };
  }

  const hasFinalSaleItem = skus.some((sku) => sku && policy.final_sale_skus.includes(sku));
  if (hasFinalSaleItem) {
    return { decision: "reject", message: "Order contains a final-sale item" };
  }

  if (policy.blocked_reasons.includes(reason)) {
    return { decision: "reject", message: "This reason isn't eligible for a return" };
  }

  if (policy.auto_approve && policy.allowed_reasons.includes(reason)) {
    return { decision: "accept" };
  }

  return { decision: "review" };
}
