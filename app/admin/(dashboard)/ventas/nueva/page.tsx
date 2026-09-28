import {
  accountAllowsCredit,
  accountAllowsKits,
} from "@/lib/admin-account-modules";
import { AdminNewPageShell } from "@/components/admin/AdminNewPageShell";
import { NuevaFacturaPageClient } from "@/components/admin/NuevaFacturaPageClient";
import type { DiningTableOption } from "@/components/admin/NewInvoiceForm";
import { fetchDiningTablesBoard } from "@/lib/admin-dining-tables";
import { loadQuotationEditDraft } from "@/lib/load-quotation-edit-draft";
import { findDefaultPosCustomerId } from "@/lib/pos-default-customer";
import {
  posPricePolicyFromConfig,
  tenantChargesVat,
} from "@/lib/product-vat-price";
import { requireAdminPermission } from "@/lib/require-admin-permission";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    error?: string;
    customer?: string;
    quotation?: string;
  }>;
};

export default async function AdminNuevaFacturaPage({ searchParams }: Props) {
  const perm = await requireAdminPermission("ventas_crear");
  const canUseCredit = accountAllowsCredit(perm.permissions);
  const canUseKits = accountAllowsKits(perm.permissions);
  const sp = await searchParams;
  const initialError = typeof sp.error === "string" ? sp.error : undefined;
  const quotationId =
    typeof sp.quotation === "string" && sp.quotation.trim().length > 0
      ? sp.quotation.trim()
      : undefined;

  const supabase = await createSupabaseServerClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("storefront_config")
    .eq("id", perm.tenantId)
    .maybeSingle();
  const pricePolicy = posPricePolicyFromConfig(tenant?.storefront_config);
  const chargeVat = tenantChargesVat(tenant?.storefront_config);

  const board = await fetchDiningTablesBoard(
    supabase,
    perm.branchContext.active.id,
  );
  const diningTables: DiningTableOption[] = board.all.map((t) => ({
    id: t.id,
    name: t.name,
    code: t.code,
    seats: t.seats,
    occupied: Boolean(t.openSession),
  }));

  if (quotationId) {
    const loaded = await loadQuotationEditDraft(supabase, quotationId);
    if (!loaded.ok) {
      if (loaded.code === "missing") redirect("/admin/ventas?error=missing");
      if (loaded.code === "not_quotation") {
        redirect(`/admin/orders/${quotationId}?error=not_quotation`);
      }
      redirect(
        `/admin/orders/${quotationId}?error=${encodeURIComponent(loaded.code)}`,
      );
    }

    return (
      <AdminNewPageShell>
        <NuevaFacturaPageClient
          initialError={initialError}
          editQuotation={loaded.draft}
          canUseCredit={canUseCredit}
          canUseKits={canUseKits}
          pricePolicy={pricePolicy}
          chargeVat={chargeVat}
          diningTables={diningTables}
        />
      </AdminNewPageShell>
    );
  }

  const fromQuery =
    typeof sp.customer === "string" && sp.customer.trim().length > 0
      ? sp.customer.trim()
      : undefined;

  const initialCustomerId =
    fromQuery ?? (await findDefaultPosCustomerId(supabase));

  return (
    <AdminNewPageShell>
      <NuevaFacturaPageClient
        initialError={initialError}
        initialCustomerId={initialCustomerId}
        canUseCredit={canUseCredit}
        canUseKits={canUseKits}
        pricePolicy={pricePolicy}
        chargeVat={chargeVat}
        diningTables={diningTables}
      />
    </AdminNewPageShell>
  );
}
