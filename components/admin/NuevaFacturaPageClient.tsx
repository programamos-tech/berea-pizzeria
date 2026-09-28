"use client";

import nextDynamic from "next/dynamic";
import { NuevaFacturaLoading } from "@/components/admin/NuevaFacturaLoading";
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
  editQuotation,
  canUseCredit = true,
  canUseKits = true,
  pricePolicy,
  chargeVat = true,
}: {
  initialError?: string;
  initialCustomerId?: string;
  editQuotation?: QuotationEditDraft;
  canUseCredit?: boolean;
  canUseKits?: boolean;
  pricePolicy?: PosPricePolicy;
  chargeVat?: boolean;
}) {
  return (
    <NuevaFacturaClient
      initialError={initialError}
      initialCustomerId={initialCustomerId}
      editQuotation={editQuotation}
      canUseCredit={canUseCredit}
      canUseKits={canUseKits}
      pricePolicy={pricePolicy}
      chargeVat={chargeVat}
    />
  );
}
