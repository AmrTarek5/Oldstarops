-- Supports the returns portal's "what would you like instead?" picker:
-- product/color/size selection from the live catalog, exchange-only.

alter table inventory_snapshot
  add column if not exists options jsonb not null default '[]',
  add column if not exists image_url text;

alter table return_requests
  add column if not exists desired_items jsonb not null default '[]';
