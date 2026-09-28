-- Categorías de insumos (Inventario → Insumos) + backfill Liaco.

alter table public.ingredients
  add column if not exists category_key text not null default 'otros';

alter table public.ingredients
  drop constraint if exists ingredients_category_key_len;

alter table public.ingredients
  add constraint ingredients_category_key_len
  check (char_length(trim(category_key)) between 1 and 40);

create index if not exists ingredients_tenant_category_idx
  on public.ingredients (tenant_id, category_key, name);

-- Asignación Liaco por slug (idempotente).
do $$
declare
  tid uuid;
begin
  select id into tid from public.tenants where slug = 'liaco' limit 1;
  if tid is null then
    return;
  end if;

  update public.ingredients set category_key = 'harinas', updated_at = now()
  where tenant_id = tid and slug in ('harina', 'levadura');

  update public.ingredients set category_key = 'basicos', updated_at = now()
  where tenant_id = tid and slug in (
    'agua', 'hielo', 'sal', 'azucar'
  );

  update public.ingredients set category_key = 'lacteos', updated_at = now()
  where tenant_id = tid and slug in (
    'mozzarella', 'queso-mozzarella', 'parmesano', 'queso-parmesano',
    'queso-azul', 'queso-crema', 'queso-pera', 'queso-para-borde',
    'leche', 'leche-en-polvo', 'esencia-de-queso', 'margarina-astra',
    'arequipe'
  );

  update public.ingredients set category_key = 'carnes', updated_at = now()
  where tenant_id = tid and slug in (
    'jamon-serrano', 'jamon', 'chorizo-espanol', 'pepperoni', 'pollo',
    'tocineta-salteada', 'chorizo-argentino-salteado', 'chorizo-argentino',
    'salami', 'pollo-bbq', 'ragu-de-carne'
  );

  update public.ingredients set category_key = 'vegetales', updated_at = now()
  where tenant_id = tid and slug in (
    'tomates-frescos', 'cebolla', 'ajo', 'maiz', 'jalapenos',
    'pina-caramelizada', 'setas', 'tomate-cherry', 'cebolla-avinada',
    'champinones', 'manzana', 'patilla', 'lychee', 'naranja',
    'puerro-crocante'
  );

  update public.ingredients set category_key = 'especias', updated_at = now()
  where tenant_id = tid and slug in (
    'oregano', 'albahaca', 'tomillo', 'albahaca-fresca', 'pepperoncino',
    'hierbabuena', 'romero', 'perejil-o-cilantro', 'picante-aji-basco'
  );

  update public.ingredients set category_key = 'bebidas', updated_at = now()
  where tenant_id = tid and slug in (
    'vino-tinto', 'vino-rosado', 'vino-blanco', 'sweet-and-sour',
    'jugo-de-naranja', 'canada-dry'
  );

  update public.ingredients set category_key = 'salsas', updated_at = now()
  where tenant_id = tid and slug in (
    'aceite-de-oliva', 'miel', 'vinagre-balsamico', 'mayonesa',
    'salsa-bbq', 'salsa-bechamel', 'pesto', 'mermelada-de-tomate-cherry',
    'salsa-de-arequipe', 'salsa-napolitana', 'mantequilla-de-ajo',
    'miel-picante', 'salsa-tartara'
  );

  update public.ingredients set category_key = 'panaderia', updated_at = now()
  where tenant_id = tid and slug in (
    'pasta-lasana', 'pan-artesanal', 'papa-ripio', 'bocadillo'
  );

  update public.ingredients set category_key = 'postres', updated_at = now()
  where tenant_id = tid and slug in (
    'brownie-preparado', 'helado-popsy-gourmet'
  );

  update public.ingredients set category_key = 'preparaciones', updated_at = now()
  where tenant_id = tid and slug in (
    'porcion-masa-napolitana', 'porcion-masa-americana'
  );
end $$;
