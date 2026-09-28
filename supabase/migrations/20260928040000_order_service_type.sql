-- Tipo de pedido Liaco: domicilio | en el lugar.

alter table public.orders
  add column if not exists service_type text null;

alter table public.orders
  drop constraint if exists orders_service_type_check;

alter table public.orders
  add constraint orders_service_type_check
  check (
    service_type is null
    or service_type in ('domicilio', 'en_el_lugar')
  );

create index if not exists orders_tenant_service_type_idx
  on public.orders (tenant_id, service_type)
  where service_type is not null;

comment on column public.orders.service_type is
  'Canal del pedido: domicilio o en_el_lugar (mesa). Null = legado (venta/cotización).';
