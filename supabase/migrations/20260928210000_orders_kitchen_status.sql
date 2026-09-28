-- Estados de cocina para pedidos de salón / domicilio (Liaco POS).

alter table public.orders
  add column if not exists kitchen_status text null;

alter table public.orders
  drop constraint if exists orders_kitchen_status_check;

alter table public.orders
  add constraint orders_kitchen_status_check
  check (
    kitchen_status is null
    or kitchen_status in (
      'recibido',
      'en_preparacion',
      'listo',
      'entregado'
    )
  );

comment on column public.orders.kitchen_status is
  'Flujo de cocina del pedido POS: recibido → en_preparacion → listo → entregado (servido).';

create index if not exists orders_tenant_kitchen_status_idx
  on public.orders (tenant_id, kitchen_status)
  where kitchen_status is not null;

-- Pedidos POS abiertos existentes → reciben estado inicial de cocina.
update public.orders
set kitchen_status = 'recibido'
where kitchen_status is null
  and status = 'pending'
  and wompi_reference like 'POS:pedido:%';
