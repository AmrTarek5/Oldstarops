import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";
import { getBulkOrders, getWhales } from "@/lib/metrics";
import { getFailedDeliveries, getInTransitStock } from "@/lib/ops";

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const days = Number(request.nextUrl.searchParams.get("days") || 0);
  const db = supabaseAdmin();

  try {
    switch (type) {
      case "orders": {
        let query = db
          .from("orders")
          .select("id, order_number, customer_name, customer_email, item_count, total, cod, financial_status, fulfillment_status, shopify_created_at")
          .order("shopify_created_at", { ascending: false });
        if (days > 0) query = query.gte("shopify_created_at", daysAgoIso(days));
        const { data, error } = await query;
        if (error) throw error;
        return csvResponse("orders.csv", toCsv(data ?? []));
      }

      case "returns": {
        let query = db
          .from("return_requests")
          .select("id, order_number, customer_name, customer_email, type, reason, status, refund_amount, revenue_recovered, created_at")
          .order("created_at", { ascending: false });
        if (days > 0) query = query.gte("created_at", daysAgoIso(days));
        const { data, error } = await query;
        if (error) throw error;
        return csvResponse("returns.csv", toCsv(data ?? []));
      }

      case "inventory": {
        const { data, error } = await db
          .from("inventory_snapshot")
          .select("variant_id, sku, barcode, product_title, variant_title, stock_qty, cost, retail_price")
          .order("product_title", { ascending: true });
        if (error) throw error;
        return csvResponse("inventory.csv", toCsv(data ?? []));
      }

      case "failed-deliveries": {
        const rows = await getFailedDeliveries();
        return csvResponse(
          "failed-deliveries.csv",
          toCsv(
            rows.map((r) => ({
              tracking_number: r.trackingNumber,
              order_number: r.orderNumber,
              customer_name: r.customerName,
              cod_amount: r.codAmount,
              updated_at: r.updatedAt,
            }))
          )
        );
      }

      case "in-transit": {
        const { rows } = await getInTransitStock();
        return csvResponse(
          "in-transit-stock.csv",
          toCsv(
            rows.map((r) => ({
              tracking_number: r.trackingNumber,
              status: r.status,
              order_number: r.orderNumber,
              customer_name: r.customerName,
              cod_amount: r.codAmount,
              stock_value_at_cost: r.stockValueAtCost,
              stock_value_at_retail: r.stockValueAtRetail,
            }))
          )
        );
      }

      case "bulk-orders": {
        const { orders } = await getBulkOrders(days || 0);
        return csvResponse("bulk-orders.csv", toCsv(orders));
      }

      case "whales": {
        const { whales } = await getWhales();
        return csvResponse("whales.csv", toCsv(whales));
      }

      case "product-profit": {
        const { data, error } = await db
          .from("v_product_profit")
          .select("*")
          .order("gross_profit", { ascending: true });
        if (error) throw error;
        return csvResponse("product-profit.csv", toCsv(data ?? []));
      }

      default:
        return NextResponse.json({ error: `Unknown export type: ${type}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
