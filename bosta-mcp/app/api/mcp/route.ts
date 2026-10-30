import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { searchDeliveries, summarizeDelivery } from "@/lib/bosta";

const mcpHandler = createMcpHandler((server) => {
  server.registerTool(
    "search_deliveries",
    {
      title: "Search Bosta deliveries",
      description:
        "Search Bosta deliveries by tracking number, customer phone, or business reference (Shopify order number). Returns a list of matching deliveries with status, COD amount, and payout info.",
      inputSchema: z.object({
        trackingNumber: z.string().optional().describe("Exact Bosta tracking number"),
        mobilePhone: z.string().optional().describe("Customer phone number"),
        businessReference: z
          .string()
          .optional()
          .describe("Order reference, e.g. a Shopify order number like #1234"),
        limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)"),
      }),
    },
    async ({ trackingNumber, mobilePhone, businessReference, limit }) => {
      const deliveries = await searchDeliveries({
        trackingNumbers: trackingNumber ? [trackingNumber] : undefined,
        mobilePhones: mobilePhone ? [mobilePhone] : undefined,
        businessReference,
        limit,
      });
      const results = deliveries.map(summarizeDelivery);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }
  );

  server.registerTool(
    "get_delivery",
    {
      title: "Get a single Bosta delivery",
      description:
        "Get full detail for one Bosta delivery by its exact tracking number, including real collected-amount and expected-cashout-date fields.",
      inputSchema: z.object({
        trackingNumber: z.string().describe("Exact Bosta tracking number"),
      }),
    },
    async ({ trackingNumber }) => {
      const deliveries = await searchDeliveries({ trackingNumbers: [trackingNumber], limit: 1 });
      if (deliveries.length === 0) {
        return { content: [{ type: "text", text: `No delivery found for tracking number ${trackingNumber}` }] };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(summarizeDelivery(deliveries[0]), null, 2) }],
      };
    }
  );
});

function checkAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.MCP_ACCESS_TOKEN;
  if (!secret) {
    return NextResponse.json({ error: "MCP_ACCESS_TOKEN is not configured" }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

async function handler(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;
  return mcpHandler(request);
}

export { handler as GET, handler as POST };
