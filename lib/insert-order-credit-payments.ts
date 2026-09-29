import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderCreditPaymentMethod } from "@/lib/order-credit";

/** Medios que entran al ledger de caja / reportes. */
export type OrderLedgerPaymentMethod =
  | OrderCreditPaymentMethod
  | "dataphone";

export type OrderCreditPaymentInsert = {
  amountCents: number;
  paymentMethod: OrderLedgerPaymentMethod;
  notes?: string | null;
};

/** Inserta cobros/abonos en order_payments. tenant_id / branch_id: trigger. */
export async function insertOrderCreditPayments(
  supabase: SupabaseClient,
  args: {
    orderId: string;
    createdBy: string;
    payments: OrderCreditPaymentInsert[];
    cashRegisterSessionId?: string | null;
  },
): Promise<"ok" | "db"> {
  const sessionId = String(args.cashRegisterSessionId ?? "").trim() || null;
  const rows = args.payments
    .map((p) => ({
      order_id: args.orderId,
      amount_cents: Math.floor(p.amountCents),
      payment_method: p.paymentMethod,
      notes: p.notes?.trim() || null,
      created_by: args.createdBy,
      cash_register_session_id: sessionId,
    }))
    .filter((p) => p.amount_cents > 0);
  if (rows.length === 0) return "ok";
  const { error } = await supabase.from("order_payments").insert(rows);
  if (error) {
    console.error("insertOrderCreditPayments", error.message);
    return "db";
  }
  return "ok";
}
