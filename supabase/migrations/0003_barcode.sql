-- Barcode generation: internal-use EAN-13 codes (GS1 "2" prefix range,
-- reserved for in-store/internal use, so these never collide with real
-- retail GTINs). A dedicated sequence guarantees uniqueness regardless of
-- how large Shopify's variant ids get.

create sequence if not exists barcode_seq start 1;

create or replace function ean13_check_digit(digits text) returns int as $$
declare
  total int := 0;
  i int;
  digit int;
begin
  for i in 1..length(digits) loop
    digit := substr(digits, i, 1)::int;
    if (length(digits) - i) % 2 = 0 then
      total := total + digit * 1;
    else
      total := total + digit * 3;
    end if;
  end loop;
  return (10 - (total % 10)) % 10;
end;
$$ language plpgsql immutable;

create or replace function next_barcode() returns text as $$
declare
  seq bigint;
  body text;
begin
  seq := nextval('barcode_seq');
  body := '20' || lpad(seq::text, 10, '0');
  return body || ean13_check_digit(body)::text;
end;
$$ language plpgsql;
