/** Desglose de cobro POS para reportes (efectivo / transferencia / mixto legacy / en línea). */
export type PosPaymentBreakdown = {
  cashCents: number;
  transferCents: number;
  mixedCents: number;
  otherCents: number;
};

export type PosPaymentBreakdownRow = {
  status: string;
  total_cents: number;
  wompi_reference: string | null;
  pos_mixed_cash_cents?: number | null;
  pos_mixed_transfer_cents?: number | null;
};

function paidTotalCents(total_cents: unknown): number {
  return Math.max(0, Math.round(Number(total_cents ?? 0)));
}

/**
 * Crédito, cotización y pedidos: el cobro cuenta el día del abono
 * (`order_payments`), no el total de la factura al marcar paid.
 */
export function isPosDeferredIncome(
  wompiReference: string | null | undefined,
): boolean {
  const ref = (wompiReference ?? "").trim();
  return (
    ref === "POS:credit" ||
    ref === "POS:quotation" ||
    ref.startsWith("POS:pedido:")
  );
}

/**
 * Reparte el total de un pedido pagado en buckets de forma de pago.
 * Mixto con columnas guardadas → efectivo + transferencia; mixto legacy sin columnas → bucket mixto.
 */
export function posPaymentBreakdownForOrder(
  row: PosPaymentBreakdownRow,
): PosPaymentBreakdown {
  const empty: PosPaymentBreakdown = {
    cashCents: 0,
    transferCents: 0,
    mixedCents: 0,
    otherCents: 0,
  };
  if (row.status !== "paid") return empty;

  const total = paidTotalCents(row.total_cents);
  const ref = (row.wompi_reference ?? "").trim();

  if (ref === "POS:cash") {
    return { ...empty, cashCents: total };
  }
  if (ref === "POS:transfer") {
    return { ...empty, transferCents: total };
  }
  if (ref === "POS:mixed") {
    const cashRaw = row.pos_mixed_cash_cents;
    const transferRaw = row.pos_mixed_transfer_cents;
    const hasSplit =
      cashRaw != null &&
      transferRaw != null &&
      Number.isFinite(Number(cashRaw)) &&
      Number.isFinite(Number(transferRaw));
    if (hasSplit) {
      const cash = Math.max(0, Math.floor(Number(cashRaw)));
      const transfer = Math.max(0, Math.floor(Number(transferRaw)));
      if (cash + transfer === total) {
        return { ...empty, cashCents: cash, transferCents: transfer };
      }
    }
    return { ...empty, mixedCents: total };
  }
  // Crédito / cotización: el dinero entra por order_payments, no por el total.
  if (isPosDeferredIncome(ref)) {
    return empty;
  }
  if (ref.startsWith("POS:")) {
    return { ...empty, mixedCents: total };
  }
  return { ...empty, otherCents: total };
}

export function sumPosPaymentBreakdowns(
  rows: PosPaymentBreakdownRow[],
): PosPaymentBreakdown {
  let cashCents = 0;
  let transferCents = 0;
  let mixedCents = 0;
  let otherCents = 0;
  for (const row of rows) {
    const b = posPaymentBreakdownForOrder(row);
    cashCents += b.cashCents;
    transferCents += b.transferCents;
    mixedCents += b.mixedCents;
    otherCents += b.otherCents;
  }
  return { cashCents, transferCents, mixedCents, otherCents };
}
