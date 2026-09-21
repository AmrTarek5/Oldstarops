// Hand-written row types mirroring supabase/migrations/0001_init.sql.
// Kept in sync manually since this is a single small private project
// (no Supabase CLI codegen step in the build).

export type DeliveryStatus =
  | "new"
  | "with_bosta"
  | "out_for_delivery"
  | "heading_back"
  | "delivered"
  | "failed";

export type ReturnType = "return" | "exchange";

export type ReturnStatus =
  | "under_review"
  | "accepted"
  | "rejected"
  | "processing"
  | "completed";

export interface OrderLineItem {
  variant_id: string | null;
  sku: string | null;
  title: string;
  quantity: number;
  price: number; // unit price charged
}

/** A variant a customer wants in exchange, picked from the live catalog. */
export interface DesiredItem {
  variant_id: string;
  product_title: string;
  options: Array<{ name: string; value: string }>;
  sku: string | null;
  quantity: number;
}

export interface OrderRow {
  id: string; // Shopify order id (as string, Shopify uses large ints/gid)
  order_number: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  items: OrderLineItem[];
  item_count: number;
  subtotal: number;
  shipping_charged: number;
  total: number;
  cod: boolean;
  financial_status: string | null;
  fulfillment_status: string | null;
  tags: string[];
  currency: string;
  shopify_created_at: string;
  raw: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DeliveryRow {
  id: string; // Bosta delivery id
  order_id: string | null;
  tracking_number: string;
  status: DeliveryStatus;
  cod_amount: number;
  bosta_fee: number;
  delivered_at: string | null;
  resolution: "restocked" | "cleared" | null;
  resolved_at: string | null;
  raw: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ReturnRequestRow {
  id: string;
  order_id: string;
  order_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  type: ReturnType;
  reason: string;
  notes: string | null;
  status: ReturnStatus;
  items: OrderLineItem[];
  desired_items: DesiredItem[];
  photo_urls: string[];
  ai_review: Record<string, unknown> | null;
  bosta_pickup_id: string | null;
  pickup_fee: number | null;
  refund_amount: number | null;
  revenue_recovered: number | null;
  created_at: string;
  updated_at: string;
}

export interface InventorySnapshotRow {
  variant_id: string;
  sku: string | null;
  barcode: string | null;
  product_id: string | null;
  product_title: string;
  variant_title: string | null;
  options: Array<{ name: string; value: string }>;
  image_url: string | null;
  stock_qty: number;
  cost: number;
  retail_price: number;
  updated_at: string;
}

export interface ReturnPolicyRow {
  id: number;
  window_days: number;
  final_sale_skus: string[];
  allowed_reasons: string[];
  blocked_reasons: string[];
  auto_approve: boolean;
  updated_at: string;
}

export interface PortalSettingsRow {
  id: number;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  policy_text: string | null;
  updated_at: string;
}

export interface VipCustomerRow {
  customer_email: string;
  customer_name: string | null;
  is_vip: boolean;
  note: string | null;
  updated_at: string;
}

export interface SyncStateRow {
  key: string;
  cursor: string | null;
  last_synced_at: string | null;
  meta: Record<string, unknown>;
}
