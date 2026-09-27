-- Top clientes y productos (pedidos pagados) agregados en la base.
-- security invoker: RLS limita a la cuenta y sucursal activas, igual que las lecturas directas.
create or replace function public.admin_report_tops(
  p_gte timestamptz,
  p_lt timestamptz,
  p_limit integer default 5
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with lim as (
    select greatest(3, least(12, coalesce(p_limit, 5))) as n
  ),
  paid as (
    select
      o.id,
      o.created_at,
      o.customer_id,
      greatest(0, round(coalesce(o.total_cents, 0)))::bigint as total,
      coalesce(
        nullif(btrim(o.customer_name), ''),
        nullif(btrim(o.customer_email), ''),
        'Cliente mostrador'
      ) as name
    from public.orders o
    where o.status = 'paid'
      and o.created_at >= p_gte
      and o.created_at < p_lt
  ),
  clients as (
    select
      coalesce(customer_id::text, 'name:' || lower(name)) as key,
      (array_agg(customer_id))[1] as customer_id,
      (array_agg(
        name
        order by (name <> 'Cliente mostrador') desc, length(name) desc, created_at
      ))[1] as name,
      count(*)::int as order_count,
      sum(total)::bigint as total_cents,
      min(created_at) as first_at
    from paid
    group by 1
    order by total_cents desc, order_count desc, first_at
    limit (select n from lim)
  ),
  lines as (
    select
      oi.product_id,
      p.created_at,
      coalesce(nullif(btrim(oi.product_name_snapshot), ''), 'Producto') as name,
      greatest(0, floor(coalesce(oi.quantity, 0)))::bigint as qty,
      greatest(0, round(coalesce(oi.unit_price_cents, 0)))::bigint as unit
    from paid p
    join public.order_items oi on oi.order_id = p.id
  ),
  products as (
    select
      coalesce(product_id::text, 'name:' || lower(name)) as key,
      (array_agg(product_id))[1] as product_id,
      (array_agg(name order by length(name) desc, created_at))[1] as name,
      sum(qty)::bigint as quantity,
      sum(qty * unit)::bigint as total_cents,
      min(created_at) as first_at
    from lines
    group by 1
    order by total_cents desc, quantity desc, first_at
    limit (select n from lim)
  )
  select jsonb_build_object(
    'clients', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', key,
          'customerId', customer_id,
          'name', name,
          'orderCount', order_count,
          'totalCents', total_cents
        )
        order by total_cents desc, order_count desc, first_at
      )
      from clients
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', key,
          'productId', product_id,
          'name', name,
          'quantity', quantity,
          'totalCents', total_cents
        )
        order by total_cents desc, quantity desc, first_at
      )
      from products
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.admin_report_tops(timestamptz, timestamptz, integer) from public;
grant execute on function public.admin_report_tops(timestamptz, timestamptz, integer) to authenticated, service_role;
