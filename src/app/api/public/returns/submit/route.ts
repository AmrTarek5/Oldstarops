import { NextRequest, NextResponse } from "next/server";
import { lookupOrderForPortal, submitReturnRequest } from "@/lib/returns";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { orderNumber, email, reason, notes, items, desiredItems, photoUrls } = body;

  if (
    typeof orderNumber !== "string" ||
    typeof email !== "string" ||
    typeof reason !== "string" ||
    !Array.isArray(items) ||
    items.length === 0 ||
    !Array.isArray(desiredItems) ||
    desiredItems.length === 0
  ) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  try {
    const order = await lookupOrderForPortal(orderNumber, email);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const { returnRequest, decision } = await submitReturnRequest({
      order,
      reason,
      notes: typeof notes === "string" ? notes : undefined,
      items,
      desiredItems,
      photoUrls: Array.isArray(photoUrls) ? photoUrls : [],
    });

    return NextResponse.json({
      ok: true,
      status: returnRequest.status,
      message:
        decision.decision === "reject"
          ? decision.message
          : decision.decision === "accept"
          ? "Your request was approved automatically. We'll arrange a pickup shortly."
          : "Your request is under review. We'll get back to you soon.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
