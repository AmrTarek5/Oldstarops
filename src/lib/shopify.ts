const API_VERSION = process.env.SHOPIFY_API_VERSION || "2024-10";

function baseUrl() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain) throw new Error("Missing SHOPIFY_STORE_DOMAIN env var");
  return `https://${domain}/admin/api/${API_VERSION}`;
}

function headers() {
  const token = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
  if (!token) throw new Error("Missing SHOPIFY_ADMIN_API_ACCESS_TOKEN env var");
  return {
    "X-Shopify-Access-Token": token,
    "Content-Type": "application/json",
  };
}

export class ShopifyApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`Shopify API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function shopifyFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    throw new ShopifyApiError(res.status, body);
  }
  return res;
}

/** Simple connectivity check used by the setup/test screen. */
export async function testShopifyConnection() {
  const res = await shopifyFetch("/shop.json");
  const data = (await res.json()) as { shop: { name: string; domain: string } };
  return data.shop;
}

export interface ShopifyOrder {
  id: number;
  name: string;
  order_number: number;
  created_at: string;
  updated_at: string;
  financial_status: string | null;
  fulfillment_status: string | null;
  currency: string;
  total_price: string;
  subtotal_price: string;
  total_shipping_price_set?: {
    shop_money: { amount: string };
  };
  tags: string;
  customer: {
    id: number;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
  line_items: Array<{
    variant_id: number | null;
    sku: string | null;
    title: string;
    quantity: number;
    price: string;
  }>;
  payment_gateway_names: string[];
}

/**
 * Pulls orders updated since `updatedAtMin`, following Shopify's Link-header
 * cursor pagination. Returns the full page list plus the next page_info
 * cursor (if any) so the caller can persist it and resume next run.
 */
export async function fetchOrdersPage(params: {
  updatedAtMin?: string;
  pageInfo?: string;
  limit?: number;
}) {
  const search = new URLSearchParams();
  search.set("limit", String(params.limit ?? 100));

  // Shopify's cursor-based pagination (page_info) rejects requests that
  // include any other filter param alongside it - only limit is allowed.
  if (params.pageInfo) {
    search.set("page_info", params.pageInfo);
  } else {
    search.set("status", "any");
    if (params.updatedAtMin) search.set("updated_at_min", params.updatedAtMin);
  }

  const res = await shopifyFetch(`/orders.json?${search.toString()}`);
  const data = (await res.json()) as { orders: ShopifyOrder[] };

  const link = res.headers.get("link");
  const nextPageInfo = parseNextPageInfo(link);

  return { orders: data.orders, nextPageInfo };
}

function parseNextPageInfo(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const parts = linkHeader.split(",");
  for (const part of parts) {
    const [urlPart, relPart] = part.split(";").map((s) => s.trim());
    if (relPart === 'rel="next"') {
      const match = urlPart.match(/page_info=([^&>]+)/);
      if (match) return decodeURIComponent(match[1]);
    }
  }
  return null;
}

/** COD orders are tagged with the "Cash on Delivery" gateway name on OldStar's store. */
export function isCodOrder(order: ShopifyOrder) {
  return order.payment_gateway_names?.some((g) =>
    /cash on delivery|cod/i.test(g)
  );
}

async function shopifyGraphQL<T>(query: string, variables: Record<string, unknown>) {
  const res = await shopifyFetch(`/graphql.json`, {
    method: "POST",
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data: T; errors?: unknown };
  if (json.errors) throw new Error(`Shopify GraphQL error: ${JSON.stringify(json.errors)}`);
  return json.data;
}

/** Numeric id from a Shopify GID, e.g. "gid://shopify/ProductVariant/123" -> "123" */
export function idFromGid(gid: string) {
  return gid.split("/").pop() ?? gid;
}

export interface ShopifyVariantNode {
  id: string; // GID
  sku: string | null;
  barcode: string | null;
  title: string;
  price: string;
  inventoryQuantity: number | null;
  inventoryItem: { unitCost: { amount: string } | null };
  product: { id: string; title: string };
}

const VARIANTS_QUERY = `
  query getVariants($cursor: String) {
    productVariants(first: 100, after: $cursor) {
      edges {
        cursor
        node {
          id
          sku
          barcode
          title
          price
          inventoryQuantity
          inventoryItem { unitCost { amount } }
          product { id title }
        }
      }
      pageInfo { hasNextPage }
    }
  }
`;

/** Pulls product variants (with cost via inventoryItem.unitCost) via the GraphQL Admin API. */
export async function fetchVariantsPage(cursor?: string) {
  const data = await shopifyGraphQL<{
    productVariants: {
      edges: Array<{ cursor: string; node: ShopifyVariantNode }>;
      pageInfo: { hasNextPage: boolean };
    };
  }>(VARIANTS_QUERY, { cursor: cursor ?? null });

  const edges = data.productVariants.edges;
  return {
    variants: edges.map((e) => e.node),
    nextCursor: data.productVariants.pageInfo.hasNextPage
      ? edges[edges.length - 1]?.cursor ?? null
      : null,
  };
}

const SET_BARCODE_MUTATION = `
  mutation setBarcode($input: ProductVariantInput!) {
    productVariantUpdate(input: $input) {
      productVariant { id barcode }
      userErrors { field message }
    }
  }
`;

/** Sets a barcode on a variant. Only called for variants that don't already have one. */
export async function setVariantBarcode(variantGid: string, barcode: string) {
  const data = await shopifyGraphQL<{
    productVariantUpdate: {
      productVariant: { id: string; barcode: string } | null;
      userErrors: Array<{ field: string; message: string }>;
    };
  }>(SET_BARCODE_MUTATION, { input: { id: variantGid, barcode } });

  if (data.productVariantUpdate.userErrors.length > 0) {
    throw new Error(
      `Shopify barcode update failed: ${JSON.stringify(data.productVariantUpdate.userErrors)}`
    );
  }
  return data.productVariantUpdate.productVariant;
}
