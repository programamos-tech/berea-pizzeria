-- Cobro por ítem: marca qué líneas del pedido ya están pagadas.

alter table public.order_items
  add column if not exists bill_paid_at timestamptz null;

alter table public.order_items
  add column if not exists bill_payment_method text null;

alter table public.order_items
  drop constraint if exists order_items_bill_payment_method_check;

alter table public.order_items
  add constraint order_items_bill_payment_method_check
  check (
    bill_payment_method is null
    or bill_payment_method in ('cash', 'transfer')
  );

comment on column public.order_items.bill_paid_at is
  'Momento en que se cobró esta línea del pedido (cuenta por ítems).';

comment on column public.order_items.bill_payment_method is
  'Medio con el que se pagó esta línea: cash | transfer.';

-- Pedidos ya pagados por completo: marcar todas las líneas.
update public.order_items oi
set
  bill_paid_at = coalesce(oi.bill_paid_at, o.created_at, now()),
  bill_payment_method = coalesce(oi.bill_payment_method, 'cash')
from public.orders o
where oi.order_id = o.id
  and oi.bill_paid_at is null
  and o.status = 'paid'
  and o.wompi_reference like 'POS:pedido:%';
