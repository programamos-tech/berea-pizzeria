"use client";

import nextDynamic from "next/dynamic";
import { NuevaFacturaLoading } from "@/components/admin/NuevaFacturaLoading";
import type { DiningTableOption } from "@/components/admin/NewInvoiceForm";
import type { QuotationEditDraft } from "@/lib/load-quotation-edit-draft";
import type { PosPricePolicy } from "@/lib/product-vat-price";

const NuevaFacturaClient = nextDynamic(
  () =>
    import("@/components/admin/NuevaFacturaClient").then(
      (mod) => mod.NuevaFacturaClient,
    ),
  {
    loading: () => <NuevaFacturaLoading />,
    // El formulario POS es pesado (~1600 líneas); cargarlo solo en cliente evita
    // timeouts intermitentes del payload RSC en redes lentas o cold starts.
    ssr: false,
  },
);

export function NuevaFacturaPageClient({
  initialError,
  initialCustomerId,
  initialDiningTableId,
  editQuotation,
  canUseCredit = true,
  canUseKits = true,
  pricePolicy,
  chargeVat = true,
  diningTables = [],
}: {
  initialError?: string;
  initialCustomerId?: string;
  initialDiningTableId?: string;
  editQuotation?: QuotationEditDraft;
  canUseCredit?: boolean;
  canUseKits?: boolean;
  pricePolicy?: PosPricePolicy;
  chargeVat?: boolean;
  diningTables?: DiningTableOption[];
}) {
  return (
    <NuevaFacturaClient
      initialError={initialError}
      initialCustomerId={initialCustomerId}
      initialDiningTableId={initialDiningTableId}
      editQuotation={editQuotation}
      canUseCredit={canUseCredit}
      canUseKits={canUseKits}
      pricePolicy={pricePolicy}
      chargeVat={chargeVat}
      diningTables={diningTables}
    />
  );
}
