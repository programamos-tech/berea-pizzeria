-- Liaco menú: insumos, recetas (BOM) y vínculo a products vendibles.

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  name text not null,
  slug text not null,
  unit text not null default 'g'
    check (unit in ('g', 'ml', 'oz', 'unidad', 'al_gusto', 'lb', 'l')),
  notes text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ingredients_name_len check (char_length(trim(name)) between 1 and 160),
  constraint ingredients_slug_fmt check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create unique index if not exists ingredients_tenant_slug_uidx
  on public.ingredients (tenant_id, slug);

create index if not exists ingredients_tenant_active_idx
  on public.ingredients (tenant_id, is_active, name);

drop trigger if exists ingredients_set_tenant on public.ingredients;
create trigger ingredients_set_tenant
  before insert on public.ingredients
  for each row execute function public.tg_set_tenant_id_from_staff();

drop trigger if exists ingredients_set_updated_at on public.ingredients;
create trigger ingredients_set_updated_at
  before update on public.ingredients
  for each row execute function public.set_updated_at();

alter table public.ingredients enable row level security;

drop policy if exists "ingredients_staff_all" on public.ingredients;
drop policy if exists "ingredients_select_staff" on public.ingredients;
drop policy if exists "ingredients_write_staff" on public.ingredients;
create policy "ingredients_select_staff"
  on public.ingredients for select to authenticated
  using (
    (select public.is_staff())
    and tenant_id = (select public.current_staff_tenant_id())
  );
create policy "ingredients_write_staff"
  on public.ingredients for all to authenticated
  using (
    (select public.is_staff())
    and tenant_id = (select public.current_staff_tenant_id())
  )
  with check (
    (select public.is_staff())
    and tenant_id = (select public.current_staff_tenant_id())
  );

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  name text not null,
  slug text not null,
  kind text not null default 'menu'
    check (kind in ('prep', 'menu')),
  category_key text not null default 'preparaciones',
  yield_qty numeric(12,3) not null default 1,
  yield_unit text not null default 'porcion',
  procedure_text text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipes_name_len check (char_length(trim(name)) between 1 and 160),
  constraint recipes_slug_fmt check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create unique index if not exists recipes_tenant_slug_uidx
  on public.recipes (tenant_id, slug);

create index if not exists recipes_tenant_kind_idx
  on public.recipes (tenant_id, kind, category_key, name);

drop trigger if exists recipes_set_tenant on public.recipes;
create trigger recipes_set_tenant
  before insert on public.recipes
  for each row execute function public.tg_set_tenant_id_from_staff();

drop trigger if exists recipes_set_updated_at on public.recipes;
create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

alter table public.recipes enable row level security;

drop policy if exists "recipes_staff_all" on public.recipes;
drop policy if exists "recipes_select_staff" on public.recipes;
drop policy if exists "recipes_write_staff" on public.recipes;
create policy "recipes_select_staff"
  on public.recipes for select to authenticated
  using (
    (select public.is_staff())
    and tenant_id = (select public.current_staff_tenant_id())
  );
create policy "recipes_write_staff"
  on public.recipes for all to authenticated
  using (
    (select public.is_staff())
    and tenant_id = (select public.current_staff_tenant_id())
  )
  with check (
    (select public.is_staff())
    and tenant_id = (select public.current_staff_tenant_id())
  );

create table if not exists public.recipe_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  ingredient_id uuid null references public.ingredients (id) on delete restrict,
  component_recipe_id uuid null references public.recipes (id) on delete restrict,
  quantity numeric(14,4) not null default 0,
  unit text not null default 'g',
  is_optional boolean not null default false,
  note text not null default '',
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  constraint recipe_lines_target check (
    (ingredient_id is not null and component_recipe_id is null)
    or (ingredient_id is null and component_recipe_id is not null)
  ),
  constraint recipe_lines_qty_nonneg check (quantity >= 0)
);

create index if not exists recipe_lines_recipe_idx
  on public.recipe_lines (recipe_id, sort_order);

drop trigger if exists recipe_lines_set_tenant on public.recipe_lines;
create trigger recipe_lines_set_tenant
  before insert on public.recipe_lines
  for each row execute function public.tg_set_tenant_id_from_staff();

alter table public.recipe_lines enable row level security;

drop policy if exists "recipe_lines_staff_all" on public.recipe_lines;
drop policy if exists "recipe_lines_select_staff" on public.recipe_lines;
drop policy if exists "recipe_lines_write_staff" on public.recipe_lines;
create policy "recipe_lines_select_staff"
  on public.recipe_lines for select to authenticated
  using (
    (select public.is_staff())
    and tenant_id = (select public.current_staff_tenant_id())
  );
create policy "recipe_lines_write_staff"
  on public.recipe_lines for all to authenticated
  using (
    (select public.is_staff())
    and tenant_id = (select public.current_staff_tenant_id())
  )
  with check (
    (select public.is_staff())
    and tenant_id = (select public.current_staff_tenant_id())
  );

alter table public.products
  add column if not exists recipe_id uuid null references public.recipes (id) on delete set null;

create index if not exists products_recipe_id_idx
  on public.products (recipe_id)
  where recipe_id is not null;

create table if not exists public.product_recipe_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_key text not null,
  label text not null,
  recipe_id uuid not null references public.recipes (id) on delete restrict,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  constraint product_recipe_variants_key_fmt check (
    variant_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  )
);

create unique index if not exists product_recipe_variants_product_key_uidx
  on public.product_recipe_variants (product_id, variant_key);

drop trigger if exists product_recipe_variants_set_tenant on public.product_recipe_variants;
create trigger product_recipe_variants_set_tenant
  before insert on public.product_recipe_variants
  for each row execute function public.tg_set_tenant_id_from_staff();

alter table public.product_recipe_variants enable row level security;

drop policy if exists "product_recipe_variants_staff_all" on public.product_recipe_variants;
drop policy if exists "product_recipe_variants_select_staff" on public.product_recipe_variants;
drop policy if exists "product_recipe_variants_write_staff" on public.product_recipe_variants;
create policy "product_recipe_variants_select_staff"
  on public.product_recipe_variants for select to authenticated
  using (
    (select public.is_staff())
    and tenant_id = (select public.current_staff_tenant_id())
  );
create policy "product_recipe_variants_write_staff"
  on public.product_recipe_variants for all to authenticated
  using (
    (select public.is_staff())
    and tenant_id = (select public.current_staff_tenant_id())
  )
  with check (
    (select public.is_staff())
    and tenant_id = (select public.current_staff_tenant_id())
  );
