-- Número corto estable por tenant para la columna Referencia del menú.

alter table public.products
  add column if not exists menu_number integer null
    check (menu_number is null or menu_number > 0);

create unique index if not exists products_tenant_menu_number_uidx
  on public.products (tenant_id, menu_number)
  where menu_number is not null;

comment on column public.products.menu_number is
  'Número de menú por tenant (1, 2, 3…). Se muestra en listados en lugar de reference larga.';

-- Backfill por created_at dentro de cada tenant.
with numbered as (
  select
    id,
    row_number() over (
      partition by tenant_id
      order by created_at asc nulls last, name asc, id asc
    )::integer as n
  from public.products
  where menu_number is null
)
update public.products p
set menu_number = numbered.n
from numbered
where p.id = numbered.id;
