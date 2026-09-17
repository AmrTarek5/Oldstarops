import { NextResponse } from "next/server";
import { testShopifyConnection } from "@/lib/shopify";
import { testBostaConnection } from "@/lib/bosta";

export async function GET() {
  const [shopify, bosta] = await Promise.allSettled([
    testShopifyConnection(),
    testBostaConnection(),
  ]);

  return NextResponse.json({
    shopify:
      shopify.status === "fulfilled"
        ? { ok: true, data: shopify.value }
        : { ok: false, error: String(shopify.reason?.message ?? shopify.reason) },
    bosta:
      bosta.status === "fulfilled"
        ? { ok: true, data: bosta.value }
        : { ok: false, error: String(bosta.reason?.message ?? bosta.reason) },
  });
}
