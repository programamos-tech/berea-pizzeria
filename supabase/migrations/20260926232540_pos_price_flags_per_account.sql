-- POS: vender por debajo (hasta $0) / por encima del precio de lista, por cuenta.
update public.tenants
set storefront_config = coalesce(storefront_config, '{}'::jsonb)
  || case slug
       when 'aleya' then '{"pos_allow_below_price": true, "pos_allow_higher_price": false}'::jsonb
       else '{"pos_allow_below_price": false}'::jsonb
     end
where slug in ('aleya', 'estacion-iphone', 'berea-tech', 'toro-technology');
