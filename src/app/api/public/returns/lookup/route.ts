import { NextRequest, NextResponse } from "next/server";
import { lookupOrderForPortal } from "@/lib/returns";
import { getReturnPolicy } from "@/lib/policy";

export async function POST(request: NextRequest) {
  const { orderNumber, email } = await request.json();
  if (typeof orderNumber !== "string" || typeof email !== "string") {
    return NextResponse.json({ error: "Missing order number or email" }, { status: 400 });
  }

  try {
    const order = await lookupOrderForPortal(orderNumber, email);
    if (!order) {
      return NextResponse.json(
        { error: "We couldn't find an order with that number and email." },
        { status: 404 }
      );
    }

    const policy = await getReturnPolicy();
    const daysSinceOrder =
      (Date.now() - new Date(order.shopify_created_at).getTime()) / (1000 * 60 * 60 * 24);

    return NextResponse.json({
      order: {
        id: order.id,
        orderNumber: order.order_number,
        createdAt: order.shopify_created_at,
        items: order.items,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
      },
      eligible: daysSinceOrder <= policy.window_days,
      windowDays: policy.window_days,
      allowedReasons: policy.allowed_reasons,
      finalSaleSkus: policy.final_sale_skus,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
