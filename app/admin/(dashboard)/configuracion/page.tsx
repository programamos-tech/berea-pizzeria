import { Blocks, Package, Printer, Tag, type LucideIcon } from "lucide-react";
import { ChargeVatSettings } from "@/components/admin/ChargeVatSettings";
import { PosPriceSettings } from "@/components/admin/HigherSalePriceSettings";
import { InvoiceLayoutSettings } from "@/components/admin/InvoiceLayoutSettings";
import { KitsModuleSettings } from "@/components/admin/KitsModuleSettings";
import { ProductCatalogFieldSettings } from "@/components/admin/ProductCatalogFieldSettings";
import { SettingsSection } from "@/components/admin/SettingsSection";
import { parseProductCatalogFields } from "@/lib/product-catalog-fields";
import { adminPageSubtitleClass, adminPageTitleClass } from "@/lib/admin-ui";
import { parseInvoiceLayout } from "@/lib/invoice-layout";
import {
  posPricePolicyFromConfig,
  tenantChargesVat,
} from "@/lib/product-vat-price";
import { loadAdminPermissions } from "@/lib/load-admin-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const SECTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "ventas", label: "Ventas y precios", icon: Tag },
  { id: "facturas", label: "Facturas", icon: Printer },
  { id: "productos", label: "Productos", icon: Package },
  { id: "modulos", label: "Módulos", icon: Blocks },
];

const noticeToneClass = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100",
  warn: "border-amber-200/90 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100",
  error: "border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100",
} as const;

const NOTICES: Record<string, { tone: keyof typeof noticeToneClass; text: string }> = {
  saved: { tone: "ok", text: "La configuración quedó actualizada." },
  forbidden: { tone: "warn", text: "Solo el propietario puede cambiar esta configuración." },
  error: { tone: "error", text: "No pudimos guardar la configuración." },
};

export default async function AdminConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const perm = await loadAdminPermissions();
  if (!perm) redirect("/admin/login");

  const sp = await searchParams;
  const notice = typeof sp.notice === "string" ? NOTICES[sp.notice] : undefined;
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
  const chargeVat = tenantChargesVat(tenant?.storefront_config);

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <header>
        <h1 className={adminPageTitleClass}>Configuración</h1>
        <p className={adminPageSubtitleClass}>
          Ajustes de {perm.tenantName}. Los cambios se guardan solos y aplican a
          todo el equipo.
        </p>
      </header>

      {notice ? (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${noticeToneClass[notice.tone]}`}
          role="status"
        >
          {notice.text}
        </div>
      ) : null}

      {!canEdit ? (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${noticeToneClass.warn}`}
          role="status"
        >
          Podés ver estos ajustes, pero solo el propietario puede cambiarlos.
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-8">
        <nav
          aria-label="Categorías de configuración"
          className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:sticky lg:top-6 lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible lg:px-0"
        >
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              className="inline-flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <Icon className="size-4 text-zinc-400" aria-hidden />
              {label}
            </a>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col gap-5">
          <SettingsSection
            id="ventas"
            icon={Tag}
            title="Ventas y precios"
            description="IVA y qué tanto puede el vendedor cambiar el precio de lista al facturar."
          >
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              <ChargeVatSettings enabled={chargeVat} canEdit={canEdit} />
              <PosPriceSettings
                allowBelow={pricePolicy.allowBelow}
                allowHigher={pricePolicy.allowHigher}
                canEdit={canEdit}
              />
            </div>
          </SettingsSection>

          <SettingsSection
            id="facturas"
            icon={Printer}
            title="Facturas"
            description="Formato de impresión de las facturas. Las cotizaciones siempre salen en hoja carta."
          >
            <InvoiceLayoutSettings current={invoiceLayout} canEdit={canEdit} />
          </SettingsSection>

          <SettingsSection
            id="productos"
            icon={Package}
            title="Productos"
            description="Campos de la ficha de producto. Los que apagues dejan de aparecer al crear o editar productos; lo que ya estaba guardado no se borra."
          >
            <ProductCatalogFieldSettings fields={productFields} canEdit={canEdit} />
          </SettingsSection>

          <SettingsSection
            id="modulos"
            icon={Blocks}
            title="Módulos"
            description="Funciones adicionales que podés encender o apagar según tu negocio."
          >
            <KitsModuleSettings
              enabled={!perm.disabledModules.includes("kits")}
              canEdit={canEdit}
            />
          </SettingsSection>
        </div>
      </div>
    </div>
  );
}
