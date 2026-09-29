-- Pedidos Cuenta: cobros en order_payments entran a reportes (como crédito).
-- Datáfono cuenta en el bucket Transferencia / En cuentas.
CREATE OR REPLACE FUNCTION public.admin_report_dashboard_agg(p_fetch_from date, p_fetch_to date, p_range_from date, p_range_to date, p_chart_from date, p_chart_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_gte timestamptz;
  v_lt timestamptz;
  v_range_gte timestamptz;
  v_range_lt timestamptz;
  v_tenant uuid;
  v_branch uuid;
  v_result jsonb;
begin
  if not public.is_staff() then
    return '{}'::jsonb;
  end if;

  v_tenant := public.current_staff_tenant_id();
  v_branch := public.current_staff_branch_id();
  if v_tenant is null or v_branch is null then
    return '{}'::jsonb;
  end if;

  if p_fetch_from is null or p_fetch_to is null
     or p_range_from is null or p_range_to is null
     or p_chart_from is null or p_chart_to is null then
    return '{}'::jsonb;
  end if;

  v_gte := (p_fetch_from::text || ' 00:00:00')::timestamp at time zone 'America/Bogota';
  v_lt := ((p_fetch_to + 1)::text || ' 00:00:00')::timestamp at time zone 'America/Bogota';
  v_range_gte := (p_range_from::text || ' 00:00:00')::timestamp at time zone 'America/Bogota';
  v_range_lt := ((p_range_to + 1)::text || ' 00:00:00')::timestamp at time zone 'America/Bogota';

  with order_rows as (
    select
      o.id,
      o.status,
      o.total_cents,
      o.created_at,
      coalesce(o.wompi_reference, '') as wompi_reference,
      o.pos_mixed_cash_cents,
      o.pos_mixed_transfer_cents,
      to_char(o.created_at at time zone 'America/Bogota', 'YYYY-MM-DD') as day_key
    from public.orders o
    where o.tenant_id = v_tenant
        and o.branch_id = v_branch
      and o.created_at >= v_gte
      and o.created_at < v_lt
  ),
  order_period as (
    select *
    from order_rows
    where day_key >= p_range_from::text
      and day_key <= p_range_to::text
  ),
  order_chart as (
    select *
    from order_rows
    where day_key >= p_chart_from::text
      and day_key <= p_chart_to::text
      and status = 'paid'
  ),
  payment_rows as (
    select
      p.amount_cents,
      p.payment_method,
      to_char(p.paid_at at time zone 'America/Bogota', 'YYYY-MM-DD') as day_key
    from public.order_payments p
    where p.tenant_id = v_tenant
        and p.branch_id = v_branch
      and p.paid_at >= v_gte
      and p.paid_at < v_lt
      and coalesce(p.is_cancelled, false) = false
  ),
  payment_period as (
    select *
    from payment_rows
    where day_key >= p_range_from::text
      and day_key <= p_range_to::text
  ),
  order_stats as (
    select
      coalesce(sum(case when status = 'paid' and wompi_reference not in ('POS:credit', 'POS:quotation')
        and wompi_reference not like 'POS:pedido:%'
        then greatest(0, coalesce(total_cents, 0)) else 0 end), 0)::bigint
      + coalesce((select sum(greatest(0, coalesce(amount_cents, 0))) from payment_period), 0)::bigint as total_cobrado,
      coalesce(sum(
        case when status = 'paid' then
          case
            when wompi_reference = 'POS:cash' then greatest(0, coalesce(total_cents, 0))
            when wompi_reference = 'POS:mixed' then greatest(0, coalesce(pos_mixed_cash_cents, 0))
            else 0
          end
        else 0 end
      ), 0)::bigint
      + coalesce((
          select sum(greatest(0, coalesce(amount_cents, 0)))
          from payment_period
          where payment_method = 'cash'
        ), 0)::bigint as efectivo,
      coalesce(sum(
        case when status = 'paid' then
          case
            when wompi_reference = 'POS:transfer' then greatest(0, coalesce(total_cents, 0))
            when wompi_reference = 'POS:mixed' then greatest(0, coalesce(pos_mixed_transfer_cents, 0))
            when wompi_reference not like 'POS:%' then greatest(0, coalesce(total_cents, 0))
            else 0
          end
        else 0 end
      ), 0)::bigint
      + coalesce((
          select sum(greatest(0, coalesce(amount_cents, 0)))
          from payment_period
          where payment_method in ('transfer', 'dataphone')
        ), 0)::bigint as transferencia,
      coalesce(count(*) filter (where status = 'cancelled'), 0)::int as anuladas,
      coalesce(sum(case when status = 'paid' and wompi_reference not like 'POS:%'
        then greatest(0, coalesce(total_cents, 0)) else 0 end), 0)::bigint as ventas_virtuales,
      coalesce(count(*) filter (where status = 'paid'), 0)::int as ventas_pagadas
    from order_period
  ),
  chart_stats as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'day_key', day_key,
          'income_cents', income_cents,
          'order_count', order_count
        )
        order by day_key
      ),
      '[]'::jsonb
    ) as points
    from (
      select
        day_key,
        coalesce(sum(income_cents), 0)::bigint as income_cents,
        coalesce(sum(order_count), 0)::int as order_count
      from (
        select
          day_key,
          sum(greatest(0, coalesce(total_cents, 0)))::bigint as income_cents,
          count(*)::int as order_count
        from order_chart
        where wompi_reference not in ('POS:credit', 'POS:quotation')
        and wompi_reference not like 'POS:pedido:%'
        group by day_key
        union all
        select
          day_key,
          sum(greatest(0, coalesce(amount_cents, 0)))::bigint,
          0
        from payment_rows
        where day_key >= p_chart_from::text
          and day_key <= p_chart_to::text
        group by day_key
      ) chart_parts
      group by day_key
    ) d
  ),
  expense_rows as (
    select
      e.id,
      e.concept,
      e.category,
      e.amount_cents,
      e.payment_method,
      e.created_at,
      coalesce(e.is_cancelled, false) as is_cancelled,
      coalesce(
        nullif(left(trim(e.expense_date::text), 10), ''),
        to_char(e.created_at at time zone 'America/Bogota', 'YYYY-MM-DD')
      ) as day_key
    from public.store_expenses e
    where e.tenant_id = v_tenant
      and e.branch_id = v_branch
      and e.expense_date >= p_fetch_from
      and e.expense_date <= p_fetch_to
      and coalesce(e.expense_kind, 'gasto') = 'gasto'
  ),
  expense_stats as (
    select
      coalesce(sum(case when not is_cancelled and day_key >= p_range_from::text and day_key <= p_range_to::text
        then greatest(0, coalesce(amount_cents, 0)) else 0 end), 0)::bigint as egresos_period,
      coalesce(count(*) filter (
        where not is_cancelled and day_key >= p_range_from::text and day_key <= p_range_to::text
      ), 0)::int as cantidad_egresos,
      coalesce(sum(case when not is_cancelled and day_key >= p_range_from::text and day_key <= p_range_to::text
        and lower(trim(coalesce(payment_method, ''))) = 'efectivo'
        then greatest(0, coalesce(amount_cents, 0)) else 0 end), 0)::bigint as egresos_efectivo,
      coalesce(sum(case when not is_cancelled and day_key >= p_range_from::text and day_key <= p_range_to::text
        and lower(trim(coalesce(payment_method, ''))) <> 'efectivo'
        then greatest(0, coalesce(amount_cents, 0)) else 0 end), 0)::bigint as egresos_otros
    from expense_rows
  ),
  expense_chart as (
    select coalesce(
      jsonb_object_agg(day_key, day_total),
      '{}'::jsonb
    ) as by_day
    from (
      select
        day_key,
        sum(greatest(0, coalesce(amount_cents, 0)))::bigint as day_total
      from expense_rows
      where not is_cancelled
        and day_key >= p_chart_from::text
        and day_key <= p_chart_to::text
      group by day_key
    ) d
  ),
  paid_period as (
    select
      o.id,
      o.total_cents,
      coalesce(o.wompi_reference, '') as wr
    from public.orders o
    where o.status = 'paid'
      and o.tenant_id = v_tenant
        and o.branch_id = v_branch
      and o.created_at >= v_range_gte
      and o.created_at < v_range_lt
  ),
  line_rows as (
    select
      p.total_cents,
      greatest(0, floor(coalesce(oi.quantity, 0)))::int as qty,
      greatest(0, round(coalesce(oi.unit_price_cents, 0)))::int as unit,
      coalesce(pr.has_vat, false) as has_vat,
      greatest(0, round(coalesce(pr.price_cents, 0)))::int as catalog_net,
      greatest(0, round(coalesce(pr.cost_cents, 0)))::int as cost_unit,
      (p.wr like 'POS:%') as is_pos,
      (p.wr in ('POS:credit', 'POS:quotation') or p.wr like 'POS:pedido:%') as is_credit,
      (oi.id is null) as no_item
    from paid_period p
    left join public.order_items oi
      on oi.order_id = p.id
     and oi.tenant_id = v_tenant
    left join public.products pr
      on pr.id = oi.product_id
     and pr.tenant_id = v_tenant
  ),
  priced as (
    select
      case
        when no_item then greatest(0, total_cents)
        when qty <= 0 then 0
        when is_pos and has_vat then
          case
            when abs(unit - catalog_net) < abs(unit - round(catalog_net * 1.19))
                 and abs(unit - catalog_net) <= greatest(2, round(catalog_net * 0.005))
            then unit * qty
            else round(unit / 1.19) * qty
          end
        when has_vat and not is_pos
             and abs(unit - catalog_net) <= greatest(4, round(catalog_net * 0.02))
          then unit * qty
        when has_vat then round(unit / 1.19) * qty
        else unit * qty
      end as net_cents,
      case
        when no_item then greatest(0, total_cents)
        when qty <= 0 then 0
        when is_pos and has_vat then
          case
            when abs(unit - catalog_net) < abs(unit - round(catalog_net * 1.19))
                 and abs(unit - catalog_net) <= greatest(2, round(catalog_net * 0.005))
            then round(unit * 1.19) * qty
            else unit * qty
          end
        when has_vat and not is_pos
             and abs(unit - catalog_net) <= greatest(4, round(catalog_net * 0.02))
          then round(unit * 1.19) * qty
        else unit * qty
      end as gross_cents,
      case
        when no_item or qty <= 0 then 0
        else cost_unit * qty
      end as cost_cents,
      is_credit
    from line_rows
  ),
  line_metrics as (
    select
      coalesce(sum(case when not is_credit then net_cents else 0 end), 0)::bigint
        + coalesce((select sum(greatest(0, coalesce(amount_cents, 0))) from payment_period), 0)::bigint as ingresos_sin_iva,
      coalesce(sum(case when not is_credit then gross_cents else 0 end), 0)::bigint
        + coalesce((select sum(greatest(0, coalesce(amount_cents, 0))) from payment_period), 0)::bigint as ingresos_con_iva,
      coalesce(sum(net_cents - cost_cents), 0)::bigint as ganancia_bruta
    from priced
  )
  select jsonb_build_object(
    'totalCobradoPedidos', (select total_cobrado from order_stats),
    'efectivo', (select efectivo from order_stats),
    'transferencia', (select transferencia from order_stats),
    'anuladas', (select anuladas from order_stats),
    'ventasVirtuales', (select ventas_virtuales from order_stats),
    'ventasPagadasPeriod', (select ventas_pagadas from order_stats),
    'paidOrderIds', '[]'::jsonb,
    'chartPoints', (select points from chart_stats),
    'expensesByChartDay', (select by_day from expense_chart),
    'egresosPeriod', (select egresos_period from expense_stats),
    'cantidadEgresosPeriod', (select cantidad_egresos from expense_stats),
    'egresosEfectivoCents', (select egresos_efectivo from expense_stats),
    'egresosTransferenciaBucketCents', (select egresos_otros from expense_stats),
    'expenseLines', '[]'::jsonb,
    'ingresosSinIva', (select ingresos_sin_iva from line_metrics),
    'ingresosConIva', (select ingresos_con_iva from line_metrics),
    'gananciaBruta', (select ganancia_bruta from line_metrics)
  )
  into v_result;

  return coalesce(v_result, '{}'::jsonb);
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_report_monthly_pulse(p_today date, p_max_months integer DEFAULT 24)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_today date;
  v_max int;
  v_first date;
  v_gte timestamptz;
  v_lt timestamptz;
  v_prior_from date;
  v_prior_to date;
  v_tenant uuid;
  v_branch uuid;
  v_result jsonb;
begin
  if not public.is_staff() then
    return jsonb_build_object('months', '[]'::jsonb, 'prior_mtd_neta', null);
  end if;

  v_tenant := public.current_staff_tenant_id();
  v_branch := public.current_staff_branch_id();
  if v_tenant is null or v_branch is null then
    return jsonb_build_object('months', '[]'::jsonb, 'prior_mtd_neta', null);
  end if;

  v_today := coalesce(
    p_today,
    (timezone('America/Bogota', now()))::date
  );
  v_max := least(greatest(coalesce(p_max_months, 24), 2), 24);

  select (date_trunc('month', x.ts))::date
  into v_first
  from (
    select min(ts) as ts
    from (
      select min(o.created_at at time zone 'America/Bogota') as ts
      from public.orders o
      where o.status = 'paid'
        and o.tenant_id = v_tenant
        and o.branch_id = v_branch
      union all
      select min(p.paid_at at time zone 'America/Bogota')
      from public.order_payments p
      where p.tenant_id = v_tenant
        and p.branch_id = v_branch
        and coalesce(p.is_cancelled, false) = false
    ) s
  ) x;

  if v_first is null then
    return jsonb_build_object('months', '[]'::jsonb, 'prior_mtd_neta', null);
  end if;

  v_first := greatest(
    v_first,
    (date_trunc('month', v_today) - make_interval(months => v_max - 1))::date
  );

  v_gte := (v_first::text || ' 00:00:00')::timestamp at time zone 'America/Bogota';
  v_lt := ((v_today + 1)::text || ' 00:00:00')::timestamp at time zone 'America/Bogota';

  v_prior_from := (date_trunc('month', v_today) - interval '1 month')::date;
  v_prior_to := least(
    v_prior_from + (extract(day from v_today)::int - 1),
    (date_trunc('month', v_today) - interval '1 day')::date
  );

  with paid as (
    select
      o.id,
      o.total_cents,
      o.created_at,
      coalesce(o.wompi_reference, '') as wr,
      to_char(o.created_at at time zone 'America/Bogota', 'YYYY-MM') as ym,
      to_char(o.created_at at time zone 'America/Bogota', 'YYYY-MM-DD') as day_key
    from public.orders o
    where o.status = 'paid'
      and o.tenant_id = v_tenant
        and o.branch_id = v_branch
      and o.created_at >= v_gte
      and o.created_at < v_lt
  ),
  lines as (
    select
      p.id as order_id,
      p.ym,
      p.day_key,
      p.total_cents,
      greatest(0, floor(coalesce(oi.quantity, 0)))::int as qty,
      greatest(0, round(coalesce(oi.unit_price_cents, 0)))::int as unit,
      coalesce(pr.has_vat, false) as has_vat,
      greatest(0, round(coalesce(pr.price_cents, 0)))::int as catalog_net,
      greatest(0, round(coalesce(pr.cost_cents, 0)))::int as cost_unit,
      (p.wr like 'POS:%') as is_pos,
      (p.wr in ('POS:credit', 'POS:quotation') or p.wr like 'POS:pedido:%') as is_credit,
      (oi.id is null) as no_item
    from paid p
    left join public.order_items oi
      on oi.order_id = p.id
     and oi.tenant_id = v_tenant
    left join public.products pr
      on pr.id = oi.product_id
     and pr.tenant_id = v_tenant
  ),
  priced as (
    select
      order_id,
      ym,
      day_key,
      case
        when no_item then greatest(0, total_cents)
        when qty <= 0 then 0
        when is_pos and has_vat then
          case
            when abs(unit - catalog_net) < abs(unit - round(catalog_net * 1.19))
                 and abs(unit - catalog_net) <= greatest(2, round(catalog_net * 0.005))
            then unit * qty
            else round(unit / 1.19) * qty
          end
        when has_vat and not is_pos
             and abs(unit - catalog_net) <= greatest(4, round(catalog_net * 0.02))
          then unit * qty
        when has_vat then round(unit / 1.19) * qty
        else unit * qty
      end as net_cents,
      case
        when no_item then greatest(0, total_cents)
        when qty <= 0 then 0
        when is_pos and has_vat then
          case
            when abs(unit - catalog_net) < abs(unit - round(catalog_net * 1.19))
                 and abs(unit - catalog_net) <= greatest(2, round(catalog_net * 0.005))
            then round(unit * 1.19) * qty
            else unit * qty
          end
        when has_vat and not is_pos
             and abs(unit - catalog_net) <= greatest(4, round(catalog_net * 0.02))
          then round(unit * 1.19) * qty
        else unit * qty
      end as gross_cents,
      case
        when no_item or qty <= 0 then 0
        else cost_unit * qty
      end as cost_cents,
      is_credit
    from lines
  ),
  pay_by_month as (
    select
      to_char(p.paid_at at time zone 'America/Bogota', 'YYYY-MM') as ym,
      coalesce(sum(greatest(0, p.amount_cents)), 0)::bigint as amt
    from public.order_payments p
    where p.tenant_id = v_tenant
        and p.branch_id = v_branch
      and coalesce(p.is_cancelled, false) = false
      and p.paid_at >= v_gte
      and p.paid_at < v_lt
    group by 1
  ),
  by_month as (
    select
      ym,
      count(distinct order_id)::int as ventas,
      coalesce(sum(case when not is_credit then gross_cents else 0 end), 0)::bigint as ingresos_con_iva,
      coalesce(sum(net_cents - cost_cents), 0)::bigint as ganancia_bruta
    from priced
    group by ym
  ),
  expenses as (
    select
      to_char(
        coalesce(
          expense_date,
          (created_at at time zone 'America/Bogota')::date
        ),
        'YYYY-MM'
      ) as ym,
      coalesce(sum(greatest(0, coalesce(amount_cents, 0))), 0)::bigint as egresos
    from public.store_expenses
    where tenant_id = v_tenant
      and branch_id = v_branch
      and coalesce(is_cancelled, false) = false
      and coalesce(expense_date, (created_at at time zone 'America/Bogota')::date)
        between v_first and v_today
    group by 1
  ),
  months as (
    select
      b.ym,
      b.ventas,
      (b.ingresos_con_iva + coalesce(pay.amt, 0))::bigint as ingresos_con_iva,
      b.ganancia_bruta,
      coalesce(e.egresos, 0)::bigint as egresos,
      (b.ganancia_bruta - coalesce(e.egresos, 0))::bigint as ganancia_neta
    from by_month b
    left join expenses e on e.ym = b.ym
    left join pay_by_month pay on pay.ym = b.ym
    union all
    select
      e.ym,
      0,
      coalesce(pay.amt, 0)::bigint,
      0::bigint,
      e.egresos,
      (0 - e.egresos)::bigint
    from expenses e
    left join pay_by_month pay on pay.ym = e.ym
    where not exists (select 1 from by_month b where b.ym = e.ym)
    union all
    select
      pay.ym,
      0,
      pay.amt,
      0::bigint,
      0::bigint,
      0::bigint
    from pay_by_month pay
    where not exists (select 1 from by_month b where b.ym = pay.ym)
      and not exists (select 1 from expenses e where e.ym = pay.ym)
  ),
  prior_mtd as (
    select
      coalesce(sum(p.net_cents - p.cost_cents), 0)::bigint
      - coalesce((
          select sum(greatest(0, coalesce(se.amount_cents, 0)))
          from public.store_expenses se
          where se.tenant_id = v_tenant
            and se.branch_id = v_branch
            and coalesce(se.is_cancelled, false) = false
            and coalesce(
              se.expense_date,
              (se.created_at at time zone 'America/Bogota')::date
            ) between v_prior_from and v_prior_to
        ), 0)::bigint as neta
    from priced p
    where p.day_key >= v_prior_from::text
      and p.day_key <= v_prior_to::text
  )
  select jsonb_build_object(
    'months', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'year_month', ym,
            'ventas', ventas,
            'ingresos_con_iva', ingresos_con_iva,
            'ganancia_bruta', ganancia_bruta,
            'egresos', egresos,
            'ganancia_neta', ganancia_neta
          )
          order by ym
        )
        from months
      ),
      '[]'::jsonb
    ),
    'prior_mtd_neta', (select neta from prior_mtd)
  )
  into v_result;

  return coalesce(
    v_result,
    jsonb_build_object('months', '[]'::jsonb, 'prior_mtd_neta', null)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_report_period_line_metrics(p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_from date;
  v_to date;
  v_gte timestamptz;
  v_lt timestamptz;
  v_tenant uuid;
  v_branch uuid;
begin
  if not public.is_staff() then
    return jsonb_build_object(
      'ingresos_sin_iva', 0,
      'ingresos_con_iva', 0,
      'ganancia_bruta', 0
    );
  end if;

  v_tenant := public.current_staff_tenant_id();
  v_branch := public.current_staff_branch_id();
  if v_tenant is null or v_branch is null or p_from is null or p_to is null then
    return jsonb_build_object(
      'ingresos_sin_iva', 0,
      'ingresos_con_iva', 0,
      'ganancia_bruta', 0
    );
  end if;

  v_from := least(p_from, p_to);
  v_to := greatest(p_from, p_to);
  v_gte := (v_from::text || ' 00:00:00')::timestamp at time zone 'America/Bogota';
  v_lt := ((v_to + 1)::text || ' 00:00:00')::timestamp at time zone 'America/Bogota';

  return (
    with paid as (
      select
        o.id,
        o.total_cents,
        coalesce(o.wompi_reference, '') as wr
      from public.orders o
      where o.status = 'paid'
        and o.tenant_id = v_tenant
        and o.branch_id = v_branch
        and o.created_at >= v_gte
        and o.created_at < v_lt
    ),
    credit_in as (
      select coalesce(sum(greatest(0, p.amount_cents)), 0)::bigint as amt
      from public.order_payments p
      where p.tenant_id = v_tenant
        and p.branch_id = v_branch
        and coalesce(p.is_cancelled, false) = false
        and p.paid_at >= v_gte
        and p.paid_at < v_lt
    ),
    lines as (
      select
        p.total_cents,
        greatest(0, floor(coalesce(oi.quantity, 0)))::int as qty,
        greatest(0, round(coalesce(oi.unit_price_cents, 0)))::int as unit,
        coalesce(pr.has_vat, false) as has_vat,
        greatest(0, round(coalesce(pr.price_cents, 0)))::int as catalog_net,
        greatest(0, round(coalesce(pr.cost_cents, 0)))::int as cost_unit,
        (p.wr like 'POS:%') as is_pos,
        (p.wr in ('POS:credit', 'POS:quotation') or p.wr like 'POS:pedido:%') as is_credit,
        (oi.id is null) as no_item
      from paid p
      left join public.order_items oi
        on oi.order_id = p.id
       and oi.tenant_id = v_tenant
      left join public.products pr
        on pr.id = oi.product_id
       and pr.tenant_id = v_tenant
    ),
    priced as (
      select
        case
          when no_item then greatest(0, total_cents)
          when qty <= 0 then 0
          when is_pos and has_vat then
            case
              when abs(unit - catalog_net) < abs(unit - round(catalog_net * 1.19))
                   and abs(unit - catalog_net) <= greatest(2, round(catalog_net * 0.005))
              then unit * qty
              else round(unit / 1.19) * qty
            end
          when has_vat and not is_pos
               and abs(unit - catalog_net) <= greatest(4, round(catalog_net * 0.02))
            then unit * qty
          when has_vat then round(unit / 1.19) * qty
          else unit * qty
        end as net_cents,
        case
          when no_item then greatest(0, total_cents)
          when qty <= 0 then 0
          when is_pos and has_vat then
            case
              when abs(unit - catalog_net) < abs(unit - round(catalog_net * 1.19))
                   and abs(unit - catalog_net) <= greatest(2, round(catalog_net * 0.005))
              then round(unit * 1.19) * qty
              else unit * qty
            end
          when has_vat and not is_pos
               and abs(unit - catalog_net) <= greatest(4, round(catalog_net * 0.02))
            then round(unit * 1.19) * qty
          else unit * qty
        end as gross_cents,
        case
          when no_item or qty <= 0 then 0
          else cost_unit * qty
        end as cost_cents,
        is_credit
      from lines
    )
    select jsonb_build_object(
      'ingresos_sin_iva', coalesce(sum(case when not is_credit then net_cents else 0 end), 0)::bigint
        + (select amt from credit_in),
      'ingresos_con_iva', coalesce(sum(case when not is_credit then gross_cents else 0 end), 0)::bigint
        + (select amt from credit_in),
      'ganancia_bruta', coalesce(sum(net_cents - cost_cents), 0)::bigint
    )
    from priced
  );
end;
$function$;
