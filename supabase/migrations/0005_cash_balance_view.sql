-- Real Bosta cash-balance split (collected-but-not-cashed-out vs. already
-- paid out), aggregated in Postgres rather than pulled into Node. A plain
-- `select *` from `deliveries` in JS is silently capped at PostgREST's
-- default 1000-row limit - with 4000+ delivered rows and growing, an
-- all-time balance computed by fetching rows into Node would quietly
-- undercount. Pushing the aggregation here avoids that entirely.
create or replace view v_cash_balance as
select
  case
    when (raw -> 'cashoutInfo' ->> 'expectedCashoutDate') is not null
         and (raw -> 'cashoutInfo' ->> 'expectedCashoutDate')::timestamptz <= now()
    then 'settled'
    else 'live'
  end as bucket,
  count(*) as delivery_count,
  coalesce(
    sum(
      coalesce(
        case when (raw -> 'flexShippingInfo' ->> 'isAmountCollected')::boolean is true
             then (raw -> 'flexShippingInfo' ->> 'collectedAmount')::numeric end,
        case when raw -> 'paymentInfo' ->> 'capturedStatus' = 'SUCCEEDED'
             then (raw -> 'paymentInfo' ->> 'amount')::numeric end,
        cod_amount,
        0
      )
    ),
    0
  ) as total_collected
from deliveries
where status = 'delivered'
group by 1;
