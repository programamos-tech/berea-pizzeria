-- Cierra sesiones de mesa open sin pedido vivo (seed demo / huérfanas).
-- Ocupación real = sesión open con order_id de pedido en_el_lugar no pagado.

update public.dining_table_sessions s
set
  status = 'closed',
  closed_at = coalesce(s.closed_at, now()),
  updated_at = now()
where s.status = 'open'
  and (
    s.order_id is null
    or not exists (
      select 1
      from public.orders o
      where o.id = s.order_id
        and o.wompi_reference like 'POS:pedido:%'
        and o.service_type = 'en_el_lugar'
        and o.status not in ('paid', 'cancelled', 'refunded')
    )
  );
