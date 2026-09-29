-- Medios de cobro de línea: efectivo, transferencia, mixto, datáfono + desglose.

alter table public.order_items
  drop constraint if exists order_items_bill_payment_method_check;

alter table public.order_items
  add constraint order_items_bill_payment_method_check
  check (
    bill_payment_method is null
    or bill_payment_method in ('cash', 'transfer', 'mixed', 'dataphone')
  );

alter table public.order_items
  add column if not exists bill_payment_breakdown jsonb null;

comment on column public.order_items.bill_payment_method is
  'Medio de cobro de la línea: cash | transfer | mixed | dataphone.';

comment on column public.order_items.bill_payment_breakdown is
  'Desglose de mixto u opcional: { cash, transfer, dataphone } en centavos.';
