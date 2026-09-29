"use client";

import {
  NewInvoiceForm,
  NewInvoiceHeader,
  type DiningTableOption,
} from "@/components/admin/NewInvoiceForm";
import type { QuotationEditDraft } from "@/lib/load-quotation-edit-draft";
import type { PosPricePolicy } from "@/lib/product-vat-price";

export function NuevaFacturaClient({
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
    <>
      <NewInvoiceHeader editQuotation={editQuotation} />
      <NewInvoiceForm
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
    </>
  );
}
