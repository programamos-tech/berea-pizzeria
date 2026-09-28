"use client";

import { NewInvoiceForm, NewInvoiceHeader } from "@/components/admin/NewInvoiceForm";
import type { QuotationEditDraft } from "@/lib/load-quotation-edit-draft";
import type { PosPricePolicy } from "@/lib/product-vat-price";

export function NuevaFacturaClient({
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
    <>
      <NewInvoiceHeader editQuotation={editQuotation} />
      <NewInvoiceForm
        initialError={initialError}
        initialCustomerId={initialCustomerId}
        editQuotation={editQuotation}
        canUseCredit={canUseCredit}
        canUseKits={canUseKits}
        pricePolicy={pricePolicy}
        chargeVat={chargeVat}
      />
    </>
  );
}
