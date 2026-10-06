-- After a public schema reset/restore, PostgREST roles lost table privileges.
-- RLS policies still gate rows; without GRANT SELECT, anon gets
-- "permission denied for table tenants" and the storefront 500s.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete, references, trigger, truncate
  on all tables in schema public
  to anon, authenticated, service_role;

grant usage, select, update
  on all sequences in schema public
  to anon, authenticated, service_role;

-- Intentional lock: admin CSRF helpers are not public.
revoke all on table public.admin_form_tokens from anon, authenticated;
grant select, insert on table public.admin_form_tokens to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete, references, trigger, truncate
  on tables to anon, authenticated, service_role;

alter default privileges in schema public
  grant usage, select, update
  on sequences to anon, authenticated, service_role;
