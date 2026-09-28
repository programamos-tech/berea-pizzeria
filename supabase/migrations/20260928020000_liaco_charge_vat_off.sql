-- Liaco: IVA apagado por defecto (storefront_config.charge_vat = false).
-- También alinea productos existentes a has_vat = false.

update public.tenants
set
  storefront_config =
    coalesce(storefront_config, '{}'::jsonb) || jsonb_build_object('charge_vat', false),
  updated_at = now()
where slug = 'liaco';

update public.products p
set
  has_vat = false,
  vat_percent = null,
  updated_at = now()
from public.tenants t
where p.tenant_id = t.id
  and t.slug = 'liaco'
  and (p.has_vat is distinct from false or p.vat_percent is not null);
