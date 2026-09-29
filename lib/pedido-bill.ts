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
