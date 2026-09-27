-- Berea Pizzerías default tenant (distinct from Facturas "aleya").
-- Trigger tenants_create_default_branch creates sucursal Principal.

insert into public.tenants (slug, name, status, kind, brand, storefront_config)
values (
  'berea-pizzerias',
  'Berea Pizzerías',
  'active',
  'customer',
  jsonb_build_object(
    'trade_name', 'Berea Pizzerías',
    'legal_name', 'Berea Pizzerías'
  ),
  jsonb_build_object(
    'checkout_mode', 'transfer',
    'invoice_layout', 'ticket'
  )
)
on conflict (slug) do update
set
  name = excluded.name,
  status = excluded.status,
  kind = excluded.kind,
  brand = excluded.brand,
  storefront_config = excluded.storefront_config,
  updated_at = now();

-- Platform operator row label (same slug "berea"; product name only).
update public.tenants
set
  name = 'Berea Pizzerías',
  brand = jsonb_build_object(
    'trade_name', 'Berea Pizzerías',
    'legal_name', 'Berea House'
  )
where slug = 'berea' and kind = 'platform';
