-- OldStar Operations & Returns App - initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a free-tier project.
-- Single-tenant tool: no RLS policies are needed since only server-side code
-- (using the service role key) talks to this database.

create extension if not exists "pgcrypto";

-- =========================================================================
-- orders (synced from Shopify)
-- =========================================================================
create table if not exists orders (
  id text primary key, -- Shopify order id
  order_number text not null,
  customer_id text,
  customer_name text,
  customer_email text,
  items jsonb not null default '[]',
  item_count int not null default 0,
  subtotal numeric(12, 2) not null default 0,
  shipping_charged numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  cod boolean not null default false,
  financial_status text,
  fulfillment_status text,
  tags text[] not null default '{}',
  currency text not null default 'EGP',
  shopify_created_at timestamptz not null,
  raw jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_customer_email_idx on orders (customer_email);
create index if not exists orders_shopify_created_at_idx on orders (shopify_created_at desc);
create index if not exists orders_item_count_idx on orders (item_count);

-- =========================================================================
-- deliveries (synced from Bosta)
-- =========================================================================
create table if not exists deliveries (
  id text primary key, -- Bosta delivery id
  order_id text references orders (id) on delete set null,
  tracking_number text not null unique,
  status text not null default 'new'
    check (status in ('new', 'with_bosta', 'out_for_delivery', 'heading_back', 'delivered', 'failed')),
  cod_amount numeric(12, 2) not null default 0,
  bosta_fee numeric(12, 2) not null default 0,
  delivered_at timestamptz,
  raw jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deliveries_order_id_idx on deliveries (order_id);
create index if not exists deliveries_status_idx on deliveries (status);

-- =========================================================================
-- return_requests
-- =========================================================================
create table if not exists return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references orders (id) on delete cascade,
  order_number text,
  customer_name text,
  customer_email text,
  type text not null check (type in ('return', 'exchange')),
  reason text not null,
  notes text,
  status text not null default 'under_review'
    check (status in ('under_review', 'accepted', 'rejected', 'processing', 'completed')),
  items jsonb not null default '[]',
  photo_urls text[] not null default '{}',
  ai_review jsonb,
  bosta_pickup_id text,
  pickup_fee numeric(12, 2),
  refund_amount numeric(12, 2),
  revenue_recovered numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists return_requests_status_idx on return_requests (status);
create index if not exists return_requests_created_at_idx on return_requests (created_at desc);

-- =========================================================================
-- inventory_snapshot (synced from Shopify products/variants)
-- =========================================================================
create table if not exists inventory_snapshot (
  variant_id text primary key,
  sku text,
  barcode text,
  product_id text,
  product_title text not null,
  variant_title text,
  stock_qty int not null default 0,
  cost numeric(12, 2) not null default 0,
  retail_price numeric(12, 2) not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists inventory_snapshot_sku_idx on inventory_snapshot (sku);
create index if not exists inventory_snapshot_barcode_idx on inventory_snapshot (barcode);

-- =========================================================================
-- return_policy (singleton row - the rules engine config)
-- =========================================================================
create table if not exists return_policy (
  id int primary key default 1,
  window_days int not null default 14,
  final_sale_skus text[] not null default '{}',
  allowed_reasons text[] not null default array[
    'wrong_size', 'changed_mind', 'defective', 'not_as_described', 'wrong_item_sent'
  ],
  blocked_reasons text[] not null default '{}',
  auto_approve boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint return_policy_singleton check (id = 1)
);

insert into return_policy (id) values (1) on conflict (id) do nothing;

-- =========================================================================
-- portal_settings (singleton row - returns portal branding)
-- =========================================================================
create table if not exists portal_settings (
  id int primary key default 1,
  logo_url text,
  primary_color text not null default '#111827',
  secondary_color text not null default '#f97316',
  policy_text text,
  updated_at timestamptz not null default now(),
  constraint portal_settings_singleton check (id = 1)
);

insert into portal_settings (id) values (1) on conflict (id) do nothing;

-- =========================================================================
-- vip_customers (manual VIP/whale flag; the dashboard also computes spend-based whales)
-- =========================================================================
create table if not exists vip_customers (
  customer_email text primary key,
  customer_name text,
  is_vip boolean not null default true,
  note text,
  updated_at timestamptz not null default now()
);

-- =========================================================================
-- sync_state (bookmarks for cron sync jobs)
-- =========================================================================
create table if not exists sync_state (
  key text primary key,
  cursor text,
  last_synced_at timestamptz,
  meta jsonb not null default '{}'
);

-- =========================================================================
-- updated_at triggers
-- =========================================================================
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists orders_set_updated_at on orders;
create trigger orders_set_updated_at before update on orders
  for each row execute function set_updated_at();

drop trigger if exists deliveries_set_updated_at on deliveries;
create trigger deliveries_set_updated_at before update on deliveries
  for each row execute function set_updated_at();

drop trigger if exists return_requests_set_updated_at on return_requests;
create trigger return_requests_set_updated_at before update on return_requests
  for each row execute function set_updated_at();
