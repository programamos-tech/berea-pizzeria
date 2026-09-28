-- Stock de insumos + historial de entradas / ajustes.

alter table public.ingredients
  add column if not exists stock_qty numeric(14,4) not null default 0;

alter table public.ingredients
  drop constraint if exists ingredients_stock_qty_nonneg;

alter table public.ingredients
  add constraint ingredients_stock_qty_nonneg check (stock_qty >= 0);

create table if not exists public.ingredient_stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  kind text not null default 'purchase'
    check (kind in ('purchase', 'adjust', 'consume')),
  quantity_delta numeric(14,4) not null,
  quantity_after numeric(14,4) not null,
  unit_cost_cents integer null check (unit_cost_cents is null or unit_cost_cents >= 0),
  note text not null default '',
  created_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ingredient_stock_movements_ingredient_idx
  on public.ingredient_stock_movements (ingredient_id, created_at desc);

create index if not exists ingredient_stock_movements_tenant_idx
  on public.ingredient_stock_movements (tenant_id, created_at desc);

drop trigger if exists ingredient_stock_movements_set_tenant
  on public.ingredient_stock_movements;
create trigger ingredient_stock_movements_set_tenant
  before insert on public.ingredient_stock_movements
  for each row execute function public.tg_set_tenant_id_from_staff();

alter table public.ingredient_stock_movements enable row level security;

drop policy if exists "ingredient_stock_movements_select_staff"
  on public.ingredient_stock_movements;
drop policy if exists "ingredient_stock_movements_write_staff"
  on public.ingredient_stock_movements;

create policy "ingredient_stock_movements_select_staff"
  on public.ingredient_stock_movements for select to authenticated
  using (
    (select public.is_staff())
    and tenant_id = (select public.current_staff_tenant_id())
  );

create policy "ingredient_stock_movements_write_staff"
  on public.ingredient_stock_movements for all to authenticated
  using (
    (select public.is_staff())
    and tenant_id = (select public.current_staff_tenant_id())
  )
  with check (
    (select public.is_staff())
    and tenant_id = (select public.current_staff_tenant_id())
  );
