/** Cobro / división de cuenta de pedidos POS. */

export type BillPaymentStatus = "pending" | "partial" | "paid";

export type PedidoBillSplit = {
  id: string;
  label: string;
  amountCents: number;
  sortOrder: number;
  paidAt: string | null;
  paymentMethod: "cash" | "transfer" | null;
};

export function isBillPaymentStatus(v: string): v is BillPaymentStatus {
  return v === "pending" || v === "partial" || v === "paid";
}

export function billPaymentStatusLabel(status: BillPaymentStatus): string {
  switch (status) {
    case "pending":
      return "Pendiente de pago";
    case "partial":
      return "Pago parcial";
    case "paid":
      return "Pagado";
    default:
      return status;
  }
}

export function billPaymentMethodLabel(
  method: "cash" | "transfer" | null | undefined,
): string {
  if (method === "cash") return "Efectivo";
  if (method === "transfer") return "Transferencia";
  return "—";
}

/** Reparte totalCents en `parts` partes iguales; el residuo va a la última. */
export function equalBillSplitAmounts(
  totalCents: number,
  parts: number,
): number[] {
  const n = Math.max(2, Math.min(12, Math.floor(parts)));
  const total = Math.max(0, Math.floor(totalCents));
  const base = Math.floor(total / n);
  const amounts = Array.from({ length: n }, () => base);
  let rem = total - base * n;
  for (let i = n - 1; i >= 0 && rem > 0; i -= 1) {
    amounts[i]! += 1;
    rem -= 1;
  }
  return amounts.filter((a) => a > 0);
}

export function sumPaidSplitCents(splits: PedidoBillSplit[]): number {
  return splits.reduce(
    (s, sp) => s + (sp.paidAt ? Math.max(0, sp.amountCents) : 0),
    0,
  );
}

export function deriveBillPaymentStatus(opts: {
  totalCents: number;
  splits: PedidoBillSplit[];
  orderStatus: string;
}): BillPaymentStatus {
  if (opts.orderStatus === "paid") return "paid";
  if (opts.splits.length === 0) return "pending";
  const paid = sumPaidSplitCents(opts.splits);
  if (paid <= 0) return "pending";
  if (paid >= opts.totalCents) return "paid";
  return "partial";
}

/** Monto cobrable de una línea (descuento incluido). */
export function lineBillAmountCents(line: {
  quantity: number;
  unitPriceCents: number;
  lineDiscountPercent?: number | null;
  lineDiscountAmountCents?: number | null;
}): number {
  const qty = Math.max(0, Math.floor(Number(line.quantity) || 0));
  const unit = Math.max(0, Math.floor(Number(line.unitPriceCents) || 0));
  const gross = unit * qty;
  const amountDisc = Math.max(
    0,
    Math.floor(Number(line.lineDiscountAmountCents ?? 0) || 0),
  );
  if (amountDisc > 0) return Math.max(0, gross - amountDisc);
  const pct = Number(line.lineDiscountPercent ?? 0);
  if (Number.isFinite(pct) && pct > 0) {
    return Math.max(0, Math.round(gross * (1 - Math.min(100, pct) / 100)));
  }
  return gross;
}

export type PedidoBillLine = {
  id: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineDiscountPercent: number | null;
  lineDiscountAmountCents: number;
  amountCents: number;
  billPaidAt: string | null;
  billPaymentMethod: "cash" | "transfer" | null;
};

export function deriveBillStatusFromLines(opts: {
  lines: Pick<PedidoBillLine, "billPaidAt">[];
  orderStatus: string;
}): BillPaymentStatus {
  if (opts.orderStatus === "paid") return "paid";
  if (opts.lines.length === 0) return "pending";
  const paidCount = opts.lines.filter((l) => l.billPaidAt != null).length;
  if (paidCount <= 0) return "pending";
  if (paidCount >= opts.lines.length) return "paid";
  return "partial";
}

export function sumUnpaidLineCents(lines: PedidoBillLine[]): number {
  return lines.reduce(
    (s, l) => s + (l.billPaidAt ? 0 : Math.max(0, l.amountCents)),
    0,
  );
}

export function sumPaidLineCents(lines: PedidoBillLine[]): number {
  return lines.reduce(
    (s, l) => s + (l.billPaidAt ? Math.max(0, l.amountCents) : 0),
    0,
  );
}
