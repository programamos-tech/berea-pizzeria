-- Datáfono en abonos / cobros de pedido (order_payments).
alter table public.order_payments
  drop constraint if exists order_payments_payment_method_check;

alter table public.order_payments
  add constraint order_payments_payment_method_check
  check (payment_method in ('cash', 'transfer', 'dataphone'));

comment on column public.order_payments.payment_method is
  'Medio de cobro: cash, transfer o dataphone.';
