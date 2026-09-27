-- Branch access resolved once per statement instead of once per row.
-- Same rule as staff_can_access_branch(), returned as the set of branch ids.
create or replace function public.staff_accessible_branch_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(b.id), '{}'::uuid[])
  from public.branches b
  where b.tenant_id = public.current_staff_tenant_id()
    and b.is_active
    and (
      public.is_platform_operator()
      or exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and (
            p.job_role in ('owner', 'admin')
            or exists (
              select 1
              from public.profile_branch_memberships m
              where m.profile_id = p.id
                and m.branch_id = b.id
            )
          )
      )
    );
$$;

revoke all on function public.staff_accessible_branch_ids() from public;
grant execute on function public.staff_accessible_branch_ids() to authenticated, service_role;

drop policy if exists branch_inventory_staff on public.branch_inventory;
create policy branch_inventory_staff on public.branch_inventory
  as permissive for all to authenticated
  using (
    tenant_id = (select public.current_staff_tenant_id())
    and branch_id = any ((select public.staff_accessible_branch_ids())::uuid[])
  )
  with check (
    tenant_id = (select public.current_staff_tenant_id())
    and branch_id = any ((select public.staff_accessible_branch_ids())::uuid[])
  );

drop policy if exists branches_select_staff on public.branches;
create policy branches_select_staff on public.branches
  as permissive for select to authenticated
  using (
    tenant_id = (select public.current_staff_tenant_id())
    and (
      (select public.is_platform_operator())
      or id = any ((select public.staff_accessible_branch_ids())::uuid[])
    )
  );

-- Staff reads are always scoped to the active branch (RLS) and usually by date.
create index if not exists orders_branch_created_at_idx
  on public.orders (branch_id, created_at desc);
create index if not exists store_expenses_branch_date_idx
  on public.store_expenses (branch_id, expense_date desc, created_at desc);
create index if not exists admin_activity_log_branch_created_at_idx
  on public.admin_activity_log (branch_id, created_at desc);
create index if not exists customers_branch_name_idx
  on public.customers (branch_id, name);

-- Foreign keys used by cascades and product/kit lookups.
create index if not exists branch_inventory_product_id_idx
  on public.branch_inventory (product_id);
create index if not exists order_items_kit_id_idx
  on public.order_items (kit_id) where kit_id is not null;
create index if not exists product_kit_items_product_id_idx
  on public.product_kit_items (product_id);
create index if not exists supplier_invoice_lines_product_id_idx
  on public.supplier_invoice_lines (product_id);

-- Covered by a composite index with the same leading column.
drop index if exists public.orders_branch_id_idx;
drop index if exists public.orders_status_idx;
drop index if exists public.order_items_order_id_idx;
drop index if exists public.order_items_product_id_idx;
drop index if exists public.store_expenses_branch_id_idx;
drop index if exists public.admin_activity_log_branch_id_idx;
drop index if exists public.customers_branch_id_idx;
