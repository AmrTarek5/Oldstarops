-- Reporting views used by the dashboard, operations hub, and returns
-- analysis pages. Aggregation is pushed to Postgres rather than pulled into
-- Node, since it's cheap here and keeps the API routes/pages simple.

-- Delivery funnel: counts + COD $ + Bosta fees, grouped by pipeline stage.
create or replace view v_delivery_funnel as
select
  status,
  count(*) as delivery_count,
  coalesce(sum(cod_amount), 0) as cod_sum,
  coalesce(sum(bosta_fee), 0) as bosta_fee_sum
from deliveries
group by status;

-- Inventory + catalog health, single-row summary.
create or replace view v_inventory_totals as
select
  coalesce(sum(stock_qty), 0) as total_units,
  coalesce(sum(stock_qty * cost), 0) as value_at_cost,
  coalesce(sum(stock_qty * retail_price), 0) as value_at_retail,
  count(*) filter (where barcode is not null and barcode <> '') as variants_with_barcode,
  count(*) filter (where barcode is null or barcode = '') as variants_without_barcode
from inventory_snapshot;

-- Per-customer lifetime spend, used for the Whales (VIP) computation.
create or replace view v_customer_spend as
select
  customer_email,
  max(customer_name) as customer_name,
  count(*) as order_count,
  coalesce(sum(total), 0) as total_spent,
  max(shopify_created_at) as last_order_at
from orders
where customer_email is not null
group by customer_email;

-- Flattened order line items (unnests the orders.items jsonb array) - a
-- building block for per-SKU profit and bulk-order line-item views.
create or replace view v_order_line_items as
select
  o.id as order_id,
  o.shopify_created_at,
  o.cod,
  item ->> 'variant_id' as variant_id,
  item ->> 'sku' as sku,
  item ->> 'title' as title,
  coalesce((item ->> 'quantity')::int, 0) as quantity,
  coalesce((item ->> 'price')::numeric, 0) as price
from orders o
cross join lateral jsonb_array_elements(o.items) as item;

-- Per-SKU gross profit: revenue vs. cost of goods, plus live stock value.
-- Variants that only exist in inventory_snapshot (never sold) are excluded
-- here by design - this view is sales-driven; the Barcode Readiness /
-- Inventory pages read inventory_snapshot directly for catalog-wide views.
create or replace view v_product_profit as
select
  li.variant_id,
  max(li.title) as title,
  coalesce(max(inv.sku), max(li.sku)) as sku,
  sum(li.quantity) as units_sold,
  sum(li.price * li.quantity) as revenue,
  sum(coalesce(inv.cost, 0) * li.quantity) as cost_of_goods,
  sum(li.price * li.quantity) - sum(coalesce(inv.cost, 0) * li.quantity) as gross_profit,
  coalesce(max(inv.stock_qty), 0) as stock_qty,
  coalesce(max(inv.stock_qty), 0) * coalesce(max(inv.cost), 0) as stock_value_at_cost
from v_order_line_items li
left join inventory_snapshot inv on inv.variant_id = li.variant_id
where li.variant_id is not null
group by li.variant_id;

-- Flattened return-request line items, for "most-returned products" analysis.
create or replace view v_return_line_items as
select
  r.id as return_id,
  r.reason,
  r.type,
  r.status,
  r.created_at,
  item ->> 'variant_id' as variant_id,
  item ->> 'sku' as sku,
  item ->> 'title' as title,
  coalesce((item ->> 'quantity')::int, 0) as quantity
from return_requests r
cross join lateral jsonb_array_elements(r.items) as item;
