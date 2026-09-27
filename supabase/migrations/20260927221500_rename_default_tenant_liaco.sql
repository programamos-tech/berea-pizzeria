-- Liaco is the default customer tenant for this product fork.
update public.tenants
set
  slug = 'liaco',
  name = 'Liaco Pizzería',
  brand = jsonb_build_object(
    'trade_name', 'Liaco Pizzería',
    'legal_name', 'Liaco Pizzería',
    'logo_path', '/logo-liaco-stacked.png'
  ),
  storefront_config = coalesce(storefront_config, '{}'::jsonb) ||
    jsonb_build_object('checkout_mode', 'transfer', 'invoice_layout', 'ticket'),
  updated_at = now()
where slug in ('liaco', 'berea-pizzerias');

insert into public.tenants (slug, name, status, kind, brand, storefront_config)
select
  'liaco',
  'Liaco Pizzería',
  'active',
  'customer',
  jsonb_build_object(
    'trade_name', 'Liaco Pizzería',
    'legal_name', 'Liaco Pizzería',
    'logo_path', '/logo-liaco-stacked.png'
  ),
  jsonb_build_object('checkout_mode', 'transfer', 'invoice_layout', 'ticket')
where not exists (select 1 from public.tenants where slug = 'liaco');
