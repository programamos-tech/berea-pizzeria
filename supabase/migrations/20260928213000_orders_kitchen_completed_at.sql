-- Marca de fin de cocina: congela el cronómetro en Servido/Entregado.

alter table public.orders
  add column if not exists kitchen_completed_at timestamptz null;

comment on column public.orders.kitchen_completed_at is
  'Momento en que el pedido pasó a kitchen_status=entregado; congela el cronómetro.';

update public.orders
set kitchen_completed_at = coalesce(updated_at, created_at)
where kitchen_status = 'entregado'
  and kitchen_completed_at is null;
