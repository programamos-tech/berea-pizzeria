-- Cuenta de pedido: pedir cuenta, dividir y pagos parciales.

alter table public.orders
  add column if not exists bill_requested_at timestamptz null;

alter table public.orders
  add column if not exists bill_payment_status text null;

alter table public.orders
  drop constraint if exists orders_bill_payment_status_check;

alter table public.orders
  add constraint orders_bill_payment_status_check
  check (
    bill_payment_status is null
    or bill_payment_status in ('pending', 'partial', 'paid')
  );

comment on column public.orders.bill_requested_at is
  'Momento en que se pidió la cuenta del pedido (facturita).';

comment on column public.orders.bill_payment_status is
  'Estado de cobro del pedido: pending | partial | paid.';

update public.orders
set bill_payment_status = 'pending'
where bill_payment_status is null
  and status = 'pending'
  and wompi_reference like 'POS:pedido:%';

update public.orders
set bill_payment_status = 'paid'
where bill_payment_status is null
  and status = 'paid'
  and wompi_reference like 'POS:pedido:%';

create table if not exists public.order_bill_splits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  branch_id uuid not null references public.branches (id),
  order_id uuid not null references public.orders (id) on delete cascade,
  label text not null,
  amount_cents integer not null check (amount_cents > 0),
  sort_order integer not null default 0,
  paid_at timestamptz null,
  payment_method text null check (
    payment_method is null
    or payment_method in ('cash', 'transfer')
  ),
  created_at timestamptz not null default now()
);

create index if not exists order_bill_splits_order_idx
  on public.order_bill_splits (order_id, sort_order);

comment on table public.order_bill_splits is
  'Partes de cuenta dividida de un pedido POS; cada parte se puede pagar por separado.';

alter table public.order_bill_splits enable row level security;

drop policy if exists order_bill_splits_select_admin on public.order_bill_splits;
create policy order_bill_splits_select_admin
on public.order_bill_splits for select to authenticated
using ((select public.is_staff()));

drop policy if exists order_bill_splits_write_admin on public.order_bill_splits;
create policy order_bill_splits_write_admin
on public.order_bill_splits for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

drop policy if exists order_bill_splits_staff_tenant_isolation on public.order_bill_splits;
create policy order_bill_splits_staff_tenant_isolation
on public.order_bill_splits as restrictive for all to authenticated
using (
  not public.is_staff_user()
  or public.staff_owns_tenant(tenant_id)
)
with check (
  not public.is_staff_user()
  or public.staff_owns_tenant(tenant_id)
);

drop policy if exists order_bill_splits_staff_branch_isolation on public.order_bill_splits;
create policy order_bill_splits_staff_branch_isolation
on public.order_bill_splits as restrictive for all to authenticated
using (
  not (select public.is_staff_user())
  or branch_id = (select public.current_staff_branch_id())
)
with check (
  not (select public.is_staff_user())
  or branch_id = (select public.current_staff_branch_id())
);

drop trigger if exists order_bill_splits_set_tenant_id on public.order_bill_splits;
create trigger order_bill_splits_set_tenant_id
before insert on public.order_bill_splits
for each row execute function public.tg_set_tenant_id_from_staff();

drop trigger if exists order_bill_splits_set_active_branch on public.order_bill_splits;
create trigger order_bill_splits_set_active_branch
before insert or update of branch_id, tenant_id on public.order_bill_splits
for each row execute function public.tg_set_active_branch();
