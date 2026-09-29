-- Roles de piso para pizzería: cocinero y mesero/servicio.
alter table public.profiles drop constraint if exists profiles_job_role_check;

alter table public.profiles
  add constraint profiles_job_role_check
  check (job_role in (
    'owner',
    'admin',
    'sales',
    'inventory',
    'kitchen',
    'service'
  ));

comment on column public.profiles.job_role is
  'Rol laboral: owner, admin, sales, inventory, kitchen (cocinero), service (mesero).';
