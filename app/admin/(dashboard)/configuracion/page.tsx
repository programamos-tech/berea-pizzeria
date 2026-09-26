import { PosPriceSettings } from "@/components/admin/HigherSalePriceSettings";
import { InvoiceLayoutSettings } from "@/components/admin/InvoiceLayoutSettings";
import { KitsModuleSettings } from "@/components/admin/KitsModuleSettings";
import { ProductCatalogFieldSettings } from "@/components/admin/ProductCatalogFieldSettings";
import { parseProductCatalogFields } from "@/lib/product-catalog-fields";
import {
  adminPageSubtitleClass,
  adminPageTitleClass,
  adminPanelClass,
} from "@/lib/admin-ui";
import { parseInvoiceLayout } from "@/lib/invoice-layout";
import { posPricePolicyFromConfig } from "@/lib/product-vat-price";
import { loadAdminPermissions } from "@/lib/load-admin-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const perm = await loadAdminPermissions();
  if (!perm) redirect("/admin/login");

  const sp = await searchParams;
  const notice = typeof sp.notice === "string" ? sp.notice : undefined;
  const canEdit = perm.jobRole === "owner" || perm.isPlatformOperator;

  const supabase = await createSupabaseServerClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("storefront_config")
    .eq("id", perm.tenantId)
    .maybeSingle();
  const invoiceLayout = parseInvoiceLayout(tenant?.storefront_config);
  const productFields = parseProductCatalogFields(tenant?.storefront_config);
  const pricePolicy = posPricePolicyFromConfig(tenant?.storefront_config);

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <header>
        <h1 className={adminPageTitleClass}>Configuración</h1>
        <p className={adminPageSubtitleClass}>
          Ajustes de la plataforma para {perm.tenantName}.
        </p>
      </header>

      {notice === "saved" ? (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100"
          role="status"
        >
          La configuración quedó actualizada.
        </div>
      ) : null}
      {notice === "forbidden" ? (
        <div
          className="rounded-lg border border-amber-200/90 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          Solo el propietario puede cambiar esta configuración.
        </div>
      ) : null}
      {notice === "error" ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-950 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
          role="status"
        >
          No pudimos guardar la configuración.
        </div>
      ) : null}

      <section className={`${adminPanelClass} p-4 sm:p-5`}>
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Módulos
        </h2>
        <div className="mt-4">
        <KitsModuleSettings
          enabled={!perm.disabledModules.includes("kits")}
          canEdit={canEdit}
        />
        </div>
        {!canEdit ? (
          <p className="mt-4 text-xs text-zinc-500">
            Solo el propietario puede encender o apagar Kits.
          </p>
        ) : null}
      </section>

      <section className={`${adminPanelClass} p-4 sm:p-5`}>
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Producto
        </h2>
        <div className="mt-4">
          <ProductCatalogFieldSettings fields={productFields} canEdit={canEdit} />
        </div>
      </section>

      <section className={`${adminPanelClass} p-4 sm:p-5`}>
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Precios en la venta
        </h2>
        <div className="mt-4">
          <PosPriceSettings
            allowBelow={pricePolicy.allowBelow}
            allowHigher={pricePolicy.allowHigher}
            canEdit={canEdit}
          />
        </div>
      </section>

      <section className={`${adminPanelClass} p-4 sm:p-5`}>
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Diseño de facturas
        </h2>
        <p className="mt-1 mb-5 text-sm text-zinc-500 dark:text-zinc-400">
          Elegí si las facturas se imprimen en tira térmica o en hoja carta, como
          las cotizaciones. Las cotizaciones siempre salen en hoja.
        </p>
        <InvoiceLayoutSettings current={invoiceLayout} canEdit={canEdit} />
        {!canEdit ? (
          <p className="mt-4 text-xs text-zinc-500">
            Solo el propietario puede cambiar el formato. Pedile que lo ajuste
            si necesitás el otro diseño.
          </p>
        ) : null}
      </section>
    </div>
  );
}
