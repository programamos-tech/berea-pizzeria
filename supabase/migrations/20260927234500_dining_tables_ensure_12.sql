-- Ensure Liaco (and berea-pizzerias) default branch has 12 mesas without wiping existing ones.

do $$
declare
  r record;
  tid uuid;
  bid uuid;
  i int;
  mesa_id uuid;
  existing int;
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

    for i in 1..12 loop
      select dt.id
        into mesa_id
      from public.dining_tables dt
      where dt.tenant_id = tid
        and dt.branch_id = bid
        and lower(trim(dt.code)) = lower(i::text)
      limit 1;

      if mesa_id is null then
        insert into public.dining_tables (
          tenant_id, branch_id, name, code, seats, sort_order
        )
        values (
          tid,
          bid,
          'Mesa ' || i,
          i::text,
          case when i <= 4 then 4 when i <= 8 then 6 else 8 end,
          i * 10
        )
        returning id into mesa_id;
      else
        update public.dining_tables
        set
          name = 'Mesa ' || i,
          seats = case when i <= 4 then 4 when i <= 8 then 6 else 8 end,
          sort_order = i * 10,
          is_active = true,
          updated_at = now()
        where id = mesa_id;
      end if;

      -- Ensure demo open sessions on 2, 5, 7, 10 (idempotent).
      if i in (2, 5, 7, 10) then
        if not exists (
          select 1
          from public.dining_table_sessions s
          where s.dining_table_id = mesa_id and s.status = 'open'
        ) then
          insert into public.dining_table_sessions (
            tenant_id, branch_id, dining_table_id, status, guest_count, note
          )
          values (
            tid,
            bid,
            mesa_id,
            'open',
            case
              when i = 5 then 6
              when i = 10 then 4
              else 2
            end,
            case
              when i = 2 then 'Pedido en cocina'
              when i = 5 then 'Familia · 6 personas'
              when i = 10 then 'Para llevar · pendiente'
              else 'Esperando postre'
            end
          );
        end if;
      end if;
    end loop;

    select count(*) into existing
    from public.dining_tables dt
    where dt.tenant_id = tid and dt.branch_id = bid and dt.is_active;

    raise notice 'tenant % branch % active mesas: %', tid, bid, existing;
  end loop;
end $$;
