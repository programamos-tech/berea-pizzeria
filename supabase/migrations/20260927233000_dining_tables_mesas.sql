-- Mesas de salón (pizzería): ocupación vía sesiones abiertas.

create table if not exists public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  branch_id uuid not null references public.branches (id) on delete cascade,
  name text not null,
  code text not null,
  seats integer not null default 4
    check (seats between 1 and 40),
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dining_tables_name_len check (char_length(trim(name)) between 1 and 80),
  constraint dining_tables_code_len check (char_length(trim(code)) between 1 and 32)
);

create unique index if not exists dining_tables_branch_code_uidx
  on public.dining_tables (branch_id, lower(trim(code)));

create index if not exists dining_tables_tenant_branch_active_idx
  on public.dining_tables (tenant_id, branch_id, is_active, sort_order);

drop trigger if exists dining_tables_set_tenant on public.dining_tables;
create trigger dining_tables_set_tenant
  before insert on public.dining_tables
  for each row
  execute function public.tg_set_tenant_id_from_staff();

drop trigger if exists dining_tables_set_updated_at on public.dining_tables;
create trigger dining_tables_set_updated_at
  before update on public.dining_tables
  for each row
  execute function public.set_updated_at();

drop trigger if exists dining_tables_set_active_branch on public.dining_tables;
create trigger dining_tables_set_active_branch
  before insert or update of branch_id, tenant_id on public.dining_tables
  for each row
  execute function public.tg_set_active_branch();

alter table public.dining_tables enable row level security;

drop policy if exists "dining_tables_select_staff" on public.dining_tables;
create policy "dining_tables_select_staff"
  on public.dining_tables
  for select
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid())
    and tenant_id = public.current_staff_tenant_id()
  );

drop policy if exists "dining_tables_write_staff" on public.dining_tables;
create policy "dining_tables_write_staff"
  on public.dining_tables
  for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid())
    and tenant_id = public.current_staff_tenant_id()
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid())
    and tenant_id = public.current_staff_tenant_id()
  );

create table if not exists public.dining_table_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  branch_id uuid not null references public.branches (id) on delete cascade,
  dining_table_id uuid not null references public.dining_tables (id) on delete cascade,
  status text not null default 'open'
    check (status in ('open', 'closed', 'cancelled')),
  guest_count integer null check (guest_count is null or guest_count between 1 and 40),
  note text null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz null,
  order_id uuid null references public.orders (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dining_table_sessions_open_idx
  on public.dining_table_sessions (dining_table_id)
  where status = 'open';

create unique index if not exists dining_table_sessions_one_open_uidx
  on public.dining_table_sessions (dining_table_id)
  where status = 'open';

create index if not exists dining_table_sessions_tenant_branch_idx
  on public.dining_table_sessions (tenant_id, branch_id, status, opened_at desc);

drop trigger if exists dining_table_sessions_set_tenant on public.dining_table_sessions;
create trigger dining_table_sessions_set_tenant
  before insert on public.dining_table_sessions
  for each row
  execute function public.tg_set_tenant_id_from_staff();

drop trigger if exists dining_table_sessions_set_updated_at on public.dining_table_sessions;
create trigger dining_table_sessions_set_updated_at
  before update on public.dining_table_sessions
  for each row
  execute function public.set_updated_at();

drop trigger if exists dining_table_sessions_set_active_branch on public.dining_table_sessions;
create trigger dining_table_sessions_set_active_branch
  before insert or update of branch_id, tenant_id on public.dining_table_sessions
  for each row
  execute function public.tg_set_active_branch();

alter table public.dining_table_sessions enable row level security;

drop policy if exists "dining_table_sessions_select_staff" on public.dining_table_sessions;
create policy "dining_table_sessions_select_staff"
  on public.dining_table_sessions
  for select
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid())
    and tenant_id = public.current_staff_tenant_id()
  );

drop policy if exists "dining_table_sessions_write_staff" on public.dining_table_sessions;
create policy "dining_table_sessions_write_staff"
  on public.dining_table_sessions
  for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid())
    and tenant_id = public.current_staff_tenant_id()
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid())
    and tenant_id = public.current_staff_tenant_id()
  );

-- Seed Liaco (y cualquier tenant sin mesas en sucursal default).
do $$
declare
  r record;
  tid uuid;
  bid uuid;
  i int;
  mesa_id uuid;
begin
  for r in
    select t.id as tenant_id, b.id as branch_id
    from public.tenants t
    join public.branches b on b.tenant_id = t.id and b.is_default and b.is_active
    where t.kind = 'customer'
      and t.slug in ('liaco', 'berea-pizzerias')
  loop
    tid := r.tenant_id;
    bid := r.branch_id;

    if exists (
      select 1 from public.dining_tables dt
      where dt.tenant_id = tid and dt.branch_id = bid
    ) then
      continue;
    end if;

    for i in 1..8 loop
      insert into public.dining_tables (
        tenant_id, branch_id, name, code, seats, sort_order
      )
      values (
        tid, bid, 'Mesa ' || i, i::text, case when i <= 4 then 4 else 6 end, i * 10
      )
      returning id into mesa_id;

      -- Algunas con pedido abierto (2, 5, 7)
      if i in (2, 5, 7) then
        insert into public.dining_table_sessions (
          tenant_id, branch_id, dining_table_id, status, guest_count, note
        )
        values (
          tid,
          bid,
          mesa_id,
          'open',
          case when i = 5 then 6 else 2 end,
          case
            when i = 2 then 'Pedido en cocina'
            when i = 5 then 'Familia · 6 personas'
            else 'Esperando postre'
          end
        );
      end if;
    end loop;
  end loop;
end $$;
