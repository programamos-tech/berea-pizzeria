-- Cliente walk-in para pedidos POS en Liaco (y berea-pizzerias demo).
insert into public.customers (tenant_id, branch_id, name, source)
select t.id, b.id, 'Cliente Final', 'manual'
from public.tenants t
join public.branches b on b.tenant_id = t.id and b.is_default and b.is_active
where t.kind = 'customer'
  and t.slug in ('liaco', 'berea-pizzerias')
  and not exists (
    select 1
    from public.customers c
    where c.tenant_id = t.id
      and lower(btrim(c.name)) = 'cliente final'
  );
