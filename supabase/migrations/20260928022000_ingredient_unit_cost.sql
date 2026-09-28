-- Costo unitario de insumos (última compra / entrada) para estimar costo de receta.

alter table public.ingredients
  add column if not exists unit_cost_cents integer null
    check (unit_cost_cents is null or unit_cost_cents >= 0);

comment on column public.ingredients.unit_cost_cents is
  'Costo COP por unidad del insumo (ingredients.unit). Se actualiza con Entrada de stock.';

-- Placeholders Liaco para que el costo estimado de pizzas no quede en $0.
-- Valores aproximados COP por unidad del insumo; se pueden corregir con Entrada.
update public.ingredients i
set unit_cost_cents = v.cost
from (
  values
    ('porcion-masa-napolitana', 10),
    ('porcion-masa-americana', 11),
    ('salsa-napolitana', 8),
    ('mozzarella', 38),
    ('queso-mozzarella', 38),
    ('pina-caramelizada', 14),
    ('salsa-bbq', 12),
    ('jalapenos', 18),
    ('tocineta-salteada', 48),
    ('cebolla', 4),
    ('harina', 3),
    ('agua', 0),
    ('aceite-de-oliva', 25),
    ('sal', 1),
    ('levadura', 40),
    ('azucar', 3),
    ('ajo', 200),
    ('jamon', 32),
    ('champinones', 16),
    ('chorizo-argentino', 35),
    ('pollo-bbq', 28)
) as v(slug, cost)
where i.slug = v.slug
  and i.tenant_id = (select id from public.tenants where slug = 'liaco' limit 1)
  and (i.unit_cost_cents is null or i.unit_cost_cents = 0);

-- Liaco: apagar campos retail irrelevantes en formularios de menú.
update public.tenants
set
  storefront_config =
    coalesce(storefront_config, '{}'::jsonb)
    || jsonb_build_object(
      'product_fields',
      coalesce(storefront_config->'product_fields', '{}'::jsonb)
        || jsonb_build_object(
          'fragrances', false,
          'colors', false,
          'expiration', false
        )
    ),
  updated_at = now()
where slug = 'liaco';
