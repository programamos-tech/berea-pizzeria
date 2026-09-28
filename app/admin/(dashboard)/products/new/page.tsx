import { NewProductForm, NewProductHeader } from "@/components/admin/NewProductForm";
import { AdminNewPageShell } from "@/components/admin/AdminNewPageShell";
import { adminCreateFailedMessage } from "@/lib/admin-create-failed-messages";
import { parseProductCatalogFields } from "@/lib/product-catalog-fields";
import { tenantChargesVat } from "@/lib/product-vat-price";
import { requireAdminPermission } from "@/lib/require-admin-permission";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const perm = await requireAdminPermission("productos_crear");
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;

  const supabase = await createSupabaseServerClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id,name")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const cats = categories ?? [];
  const { data: tenant } = await supabase
    .from("tenants")
    .select("storefront_config")
    .eq("id", perm.tenantId)
    .maybeSingle();
  const catalogFields = parseProductCatalogFields(tenant?.storefront_config);
  const chargeVat = tenantChargesVat(tenant?.storefront_config);

  return (
    <AdminNewPageShell>
      <NewProductHeader />

      {error ? (
        <p className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/35 dark:text-red-100">
          {error === "reference"
            ? "La referencia es obligatoria. Completa el código del producto."
            : error === "duplicate_reference"
              ? "Ya existe un producto con esa referencia o código."
            : error === "name"
              ? "El nombre es obligatorio."
              : error === "rls"
                ? "No tienes permiso para crear productos. Tu usuario de Supabase tiene que tener una fila en la tabla public.profiles con rol admin (misma id que auth.users)."
                : adminCreateFailedMessage("product")}
        </p>
      ) : null}

      <NewProductForm
        categories={cats}
        catalogFields={catalogFields}
        chargeVat={chargeVat}
      />
    </AdminNewPageShell>
  );
}
