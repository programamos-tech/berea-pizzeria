"use server";

import {
  deriveBillPaymentStatus,
  deriveBillStatusFromLines,
  equalBillSplitAmounts,
  isPedidoBillPaymentMethod,
  isValidMixedBreakdown,
  type BillPaymentStatus,
  type PedidoBillPaymentBreakdown,
  type PedidoBillPaymentMethod,
} from "@/lib/pedido-bill";
import { loadAdminPermissions } from "@/lib/load-admin-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type ActionErr =
  | "auth"
  | "forbidden"
  | "invalid"
  | "db"
  | "not_pedido"
  | "cancelled"
  | "already_paid"
  | "has_paid_splits"
  | "no_lines"
  | "mixed"
  | "no_mesa";

async function loadPedidoOrder(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  orderId: string,
) {
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id,status,total_cents,wompi_reference,bill_requested_at,bill_payment_status,tenant_id,branch_id",
    )
    .eq("id", orderId)
    .maybeSingle();
  return order;
}

function assertPedido(order: {
  wompi_reference?: string | null;
  status?: string | null;
}): ActionErr | null {
  const ref =
    order.wompi_reference != null ? String(order.wompi_reference) : "";
  if (!ref.startsWith("POS:pedido:")) return "not_pedido";
  if (String(order.status) === "cancelled") return "cancelled";
  return null;
}

function revalidatePedido(orderId: string) {
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/ventas");
  revalidatePath("/admin/orders");
}

async function refreshBillPaymentStatus(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  orderId: string,
  totalCents: number,
  orderStatus: string,
): Promise<BillPaymentStatus> {
  const { data: splits } = await supabase
    .from("order_bill_splits")
    .select("id,amount_cents,paid_at")
    .eq("order_id", orderId);

  const mapped = (splits ?? []).map((s) => ({
    id: String(s.id),
    label: "",
    amountCents: Math.max(0, Number(s.amount_cents ?? 0)),
    sortOrder: 0,
    paidAt: s.paid_at != null ? String(s.paid_at) : null,
    paymentMethod: null as "cash" | "transfer" | null,
  }));

  const status = deriveBillPaymentStatus({
    totalCents,
    splits: mapped,
    orderStatus,
  });

  await supabase
    .from("orders")
    .update({ bill_payment_status: status })
    .eq("id", orderId);

  return status;
}

async function closeDiningSessionIfAny(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  orderId: string,
) {
  await supabase
    .from("dining_table_sessions")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("order_id", orderId)
    .eq("status", "open");
}

export async function requestPedidoBill(orderId: string): Promise<
  | { ok: true; billRequestedAt: string }
  | { ok: false; error: ActionErr }
> {
  const id = String(orderId ?? "").trim();
  if (!id) return { ok: false, error: "invalid" };

  const perm = await loadAdminPermissions();
  if (!perm) return { ok: false, error: "auth" };
  if (!perm.permissions.ventas_crear && !perm.permissions.ventas_ver) {
    return { ok: false, error: "forbidden" };
  }

  const supabase = await createSupabaseServerClient();
  const order = await loadPedidoOrder(supabase, id);
  if (!order) return { ok: false, error: "db" };
  const bad = assertPedido(order);
  if (bad) return { ok: false, error: bad };

  const existing =
    order.bill_requested_at != null ? String(order.bill_requested_at) : null;
  const billRequestedAt = existing || new Date().toISOString();

  const { error } = await supabase
    .from("orders")
    .update({
      bill_requested_at: billRequestedAt,
      bill_payment_status:
        order.bill_payment_status ??
        (String(order.status) === "paid" ? "paid" : "pending"),
    })
    .eq("id", id);

  if (error) return { ok: false, error: "db" };
  revalidatePedido(id);
  return { ok: true, billRequestedAt };
}

export async function splitPedidoBillEqual(
  orderId: string,
  parts: number,
): Promise<{ ok: true } | { ok: false; error: ActionErr }> {
  const id = String(orderId ?? "").trim();
  const n = Math.floor(Number(parts));
  if (!id || n < 2 || n > 12) return { ok: false, error: "invalid" };

  const perm = await loadAdminPermissions();
  if (!perm) return { ok: false, error: "auth" };
  if (!perm.permissions.ventas_crear) return { ok: false, error: "forbidden" };

  const supabase = await createSupabaseServerClient();
  const order = await loadPedidoOrder(supabase, id);
  if (!order) return { ok: false, error: "db" };
  const bad = assertPedido(order);
  if (bad) return { ok: false, error: bad };
  if (String(order.status) === "paid") return { ok: false, error: "already_paid" };

  const { data: existing } = await supabase
    .from("order_bill_splits")
    .select("id,paid_at")
    .eq("order_id", id);
  if ((existing ?? []).some((s) => s.paid_at != null)) {
    return { ok: false, error: "has_paid_splits" };
  }

  if ((existing ?? []).length > 0) {
    const { error: delErr } = await supabase
      .from("order_bill_splits")
      .delete()
      .eq("order_id", id);
    if (delErr) return { ok: false, error: "db" };
  }

  const totalCents = Math.max(0, Math.floor(Number(order.total_cents ?? 0)));
  const amounts = equalBillSplitAmounts(totalCents, n);
  if (amounts.length < 2) return { ok: false, error: "invalid" };

  const rows = amounts.map((amountCents, i) => ({
    order_id: id,
    label: `Parte ${i + 1}`,
    amount_cents: amountCents,
    sort_order: i,
    tenant_id: order.tenant_id != null ? String(order.tenant_id) : undefined,
    branch_id: order.branch_id != null ? String(order.branch_id) : undefined,
  }));

  const { error: insErr } = await supabase.from("order_bill_splits").insert(rows);
  if (insErr) return { ok: false, error: "db" };

  await supabase
    .from("orders")
    .update({
      bill_requested_at:
        order.bill_requested_at != null
          ? String(order.bill_requested_at)
          : new Date().toISOString(),
      bill_payment_status: "pending",
    })
    .eq("id", id);

  revalidatePedido(id);
  return { ok: true };
}

export async function clearPedidoBillSplits(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: ActionErr }> {
  const id = String(orderId ?? "").trim();
  if (!id) return { ok: false, error: "invalid" };

  const perm = await loadAdminPermissions();
  if (!perm) return { ok: false, error: "auth" };
  if (!perm.permissions.ventas_crear) return { ok: false, error: "forbidden" };

  const supabase = await createSupabaseServerClient();
  const order = await loadPedidoOrder(supabase, id);
  if (!order) return { ok: false, error: "db" };
  const bad = assertPedido(order);
  if (bad) return { ok: false, error: bad };
  if (String(order.status) === "paid") return { ok: false, error: "already_paid" };

  const { data: existing } = await supabase
    .from("order_bill_splits")
    .select("id,paid_at")
    .eq("order_id", id);
  if ((existing ?? []).some((s) => s.paid_at != null)) {
    return { ok: false, error: "has_paid_splits" };
  }

  const { error } = await supabase
    .from("order_bill_splits")
    .delete()
    .eq("order_id", id);
  if (error) return { ok: false, error: "db" };

  await supabase
    .from("orders")
    .update({ bill_payment_status: "pending" })
    .eq("id", id);

  revalidatePedido(id);
  return { ok: true };
}

export async function payPedidoBill(input: {
  orderId: string;
  paymentMethod: "cash" | "transfer";
  /** Si hay divisiones, id de la parte a pagar. Si no hay, cobra el total. */
  splitId?: string | null;
}): Promise<
  | { ok: true; billPaymentStatus: BillPaymentStatus }
  | { ok: false; error: ActionErr }
> {
  const id = String(input.orderId ?? "").trim();
  const method = input.paymentMethod;
  const splitId =
    input.splitId != null ? String(input.splitId).trim() || null : null;
  if (!id || (method !== "cash" && method !== "transfer")) {
    return { ok: false, error: "invalid" };
  }

  const perm = await loadAdminPermissions();
  if (!perm) return { ok: false, error: "auth" };
  if (!perm.permissions.ventas_crear) return { ok: false, error: "forbidden" };

  const supabase = await createSupabaseServerClient();
  const order = await loadPedidoOrder(supabase, id);
  if (!order) return { ok: false, error: "db" };
  const bad = assertPedido(order);
  if (bad) return { ok: false, error: bad };
  if (String(order.status) === "paid") return { ok: false, error: "already_paid" };

  const totalCents = Math.max(0, Math.floor(Number(order.total_cents ?? 0)));
  const nowIso = new Date().toISOString();

  const { data: splits } = await supabase
    .from("order_bill_splits")
    .select("id,amount_cents,paid_at,sort_order,label")
    .eq("order_id", id)
    .order("sort_order", { ascending: true });

  const splitRows = splits ?? [];

  if (splitRows.length > 0) {
    if (!splitId) return { ok: false, error: "invalid" };
    const target = splitRows.find((s) => String(s.id) === splitId);
    if (!target) return { ok: false, error: "invalid" };
    if (target.paid_at != null) return { ok: false, error: "already_paid" };

    const { error: payErr } = await supabase
      .from("order_bill_splits")
      .update({
        paid_at: nowIso,
        payment_method: method,
      })
      .eq("id", splitId)
      .eq("order_id", id);
    if (payErr) return { ok: false, error: "db" };

    const allPaid = splitRows.every(
      (s) => String(s.id) === splitId || s.paid_at != null,
    );

    if (allPaid) {
      const { error: ordErr } = await supabase
        .from("orders")
        .update({
          status: "paid",
          bill_payment_status: "paid",
          bill_requested_at:
            order.bill_requested_at != null
              ? String(order.bill_requested_at)
              : nowIso,
        })
        .eq("id", id);
      if (ordErr) return { ok: false, error: "db" };
      await closeDiningSessionIfAny(supabase, id);
      revalidatePedido(id);
      return { ok: true, billPaymentStatus: "paid" };
    }

    const status = await refreshBillPaymentStatus(
      supabase,
      id,
      totalCents,
      "pending",
    );
    await supabase
      .from("orders")
      .update({
        bill_requested_at:
          order.bill_requested_at != null
            ? String(order.bill_requested_at)
            : nowIso,
        bill_payment_status: status,
      })
      .eq("id", id);
    revalidatePedido(id);
    return { ok: true, billPaymentStatus: status };
  }

  // Sin divisiones: pago total
  const { error: ordErr } = await supabase
    .from("orders")
    .update({
      status: "paid",
      bill_payment_status: "paid",
      bill_requested_at:
        order.bill_requested_at != null
          ? String(order.bill_requested_at)
          : nowIso,
    })
    .eq("id", id);
  if (ordErr) return { ok: false, error: "db" };

  await closeDiningSessionIfAny(supabase, id);
  revalidatePedido(id);
  return { ok: true, billPaymentStatus: "paid" };
}

/** Cobra líneas seleccionadas del pedido (checkbox por producto). */
export async function payPedidoBillLines(input: {
  orderId: string;
  lineIds: string[];
  paymentMethod: PedidoBillPaymentMethod;
  /** Requerido si paymentMethod === "mixed". */
  mixedBreakdown?: PedidoBillPaymentBreakdown | null;
}): Promise<
  | {
      ok: true;
      billPaymentStatus: BillPaymentStatus;
      paidLineIds: string[];
      suggestLiberarMesa: boolean;
    }
  | { ok: false; error: ActionErr }
> {
  const id = String(input.orderId ?? "").trim();
  const method = input.paymentMethod;
  const lineIds = [
    ...new Set(
      (input.lineIds ?? [])
        .map((x) => String(x ?? "").trim())
        .filter((x) => x.length > 0),
    ),
  ];
  if (!id || !isPedidoBillPaymentMethod(method) || lineIds.length === 0) {
    return { ok: false, error: "invalid" };
  }

  const perm = await loadAdminPermissions();
  if (!perm) return { ok: false, error: "auth" };
  if (!perm.permissions.ventas_crear) return { ok: false, error: "forbidden" };

  const supabase = await createSupabaseServerClient();
  const order = await loadPedidoOrder(supabase, id);
  if (!order) return { ok: false, error: "db" };
  const bad = assertPedido(order);
  if (bad) return { ok: false, error: bad };
  if (String(order.status) === "paid") return { ok: false, error: "already_paid" };

  const { data: allLines, error: linesErr } = await supabase
    .from("order_items")
    .select("id,bill_paid_at,quantity,unit_price_cents,line_discount_percent,line_discount_amount_cents")
    .eq("order_id", id);
  if (linesErr) return { ok: false, error: "db" };
  const rows = allLines ?? [];
  if (rows.length === 0) return { ok: false, error: "no_lines" };

  const byId = new Map(rows.map((r) => [String(r.id), r]));
  let selectedTotal = 0;
  for (const lid of lineIds) {
    const row = byId.get(lid);
    if (!row) return { ok: false, error: "invalid" };
    if (row.bill_paid_at != null) return { ok: false, error: "already_paid" };
    const qty = Math.max(0, Math.floor(Number(row.quantity ?? 0)));
    const unit = Math.max(0, Math.floor(Number(row.unit_price_cents ?? 0)));
    const gross = unit * qty;
    const amountDisc = Math.max(
      0,
      Math.floor(Number(row.line_discount_amount_cents ?? 0)),
    );
    let amount = gross;
    if (amountDisc > 0) amount = Math.max(0, gross - amountDisc);
    else {
      const pct = Number(row.line_discount_percent ?? 0);
      if (Number.isFinite(pct) && pct > 0) {
        amount = Math.max(0, Math.round(gross * (1 - Math.min(100, pct) / 100)));
      }
    }
    selectedTotal += amount;
  }

  let breakdown: PedidoBillPaymentBreakdown | null = null;
  if (method === "mixed") {
    const raw = input.mixedBreakdown;
    if (
      !raw ||
      !isValidMixedBreakdown(
        {
          cash: Math.max(0, Math.floor(Number(raw.cash ?? 0))),
          transfer: Math.max(0, Math.floor(Number(raw.transfer ?? 0))),
          dataphone: Math.max(0, Math.floor(Number(raw.dataphone ?? 0))),
        },
        selectedTotal,
      )
    ) {
      return { ok: false, error: "mixed" };
    }
    breakdown = {
      cash: Math.max(0, Math.floor(Number(raw.cash ?? 0))),
      transfer: Math.max(0, Math.floor(Number(raw.transfer ?? 0))),
      dataphone: Math.max(0, Math.floor(Number(raw.dataphone ?? 0))),
    };
  }

  const nowIso = new Date().toISOString();
  const { error: payErr } = await supabase
    .from("order_items")
    .update({
      bill_paid_at: nowIso,
      bill_payment_method: method,
      bill_payment_breakdown: breakdown,
    })
    .eq("order_id", id)
    .in("id", lineIds)
    .is("bill_paid_at", null);
  if (payErr) return { ok: false, error: "db" };

  const nextLines = rows.map((r) => ({
    billPaidAt:
      lineIds.includes(String(r.id)) || r.bill_paid_at != null
        ? nowIso
        : null,
  }));
  const status = deriveBillStatusFromLines({
    lines: nextLines,
    orderStatus: "pending",
  });

  if (status === "paid") {
    const { error: ordErr } = await supabase
      .from("orders")
      .update({
        status: "paid",
        bill_payment_status: "paid",
        bill_requested_at:
          order.bill_requested_at != null
            ? String(order.bill_requested_at)
            : nowIso,
      })
      .eq("id", id);
    if (ordErr) return { ok: false, error: "db" };
    // No cierra mesa sola: el usuario libera con CTA en el detalle.
    const { data: openSess } = await supabase
      .from("dining_table_sessions")
      .select("id")
      .eq("order_id", id)
      .eq("status", "open")
      .maybeSingle();
    revalidatePedido(id);
    return {
      ok: true,
      billPaymentStatus: "paid",
      paidLineIds: lineIds,
      suggestLiberarMesa: Boolean(openSess?.id),
    };
  }

  const { error: ordErr } = await supabase
    .from("orders")
    .update({
      bill_requested_at:
        order.bill_requested_at != null
          ? String(order.bill_requested_at)
          : nowIso,
      bill_payment_status: status,
    })
    .eq("id", id);
  if (ordErr) return { ok: false, error: "db" };

  revalidatePedido(id);
  return {
    ok: true,
    billPaymentStatus: status,
    paidLineIds: lineIds,
    suggestLiberarMesa: false,
  };
}

/** Libera la mesa asociada al pedido (cierra sesión de comedor abierta). */
export async function liberarPedidoMesa(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: ActionErr }> {
  const id = String(orderId ?? "").trim();
  if (!id) return { ok: false, error: "invalid" };

  const perm = await loadAdminPermissions();
  if (!perm) return { ok: false, error: "auth" };
  if (!perm.permissions.ventas_crear && !perm.permissions.ventas_ver) {
    return { ok: false, error: "forbidden" };
  }

  const supabase = await createSupabaseServerClient();
  const order = await loadPedidoOrder(supabase, id);
  if (!order) return { ok: false, error: "db" };
  const bad = assertPedido(order);
  if (bad) return { ok: false, error: bad };

  const { data: sess } = await supabase
    .from("dining_table_sessions")
    .select("id")
    .eq("order_id", id)
    .eq("status", "open")
    .maybeSingle();
  if (!sess?.id) return { ok: false, error: "no_mesa" };

  const { error } = await supabase
    .from("dining_table_sessions")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", String(sess.id))
    .eq("status", "open");
  if (error) return { ok: false, error: "db" };

  revalidatePedido(id);
  revalidatePath("/admin/reportes");
  return { ok: true };
}
