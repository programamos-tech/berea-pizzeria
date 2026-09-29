"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  clearPedidoBillSplits,
  payPedidoBill,
  requestPedidoBill,
  splitPedidoBillEqual,
} from "@/app/actions/admin/pedido-bill";
import {
  billPaymentMethodLabel,
  billPaymentStatusLabel,
  equalBillSplitAmounts,
  sumPaidSplitCents,
  type BillPaymentStatus,
  type PedidoBillSplit,
} from "@/lib/pedido-bill";
import { formatCop } from "@/lib/money";
import { formatStoreDateTime } from "@/lib/store-datetime-format";

export type PedidoCuentaLine = {
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

function statusTone(status: BillPaymentStatus): string {
  switch (status) {
    case "paid":
      return "font-semibold text-emerald-700 dark:text-emerald-400";
    case "partial":
      return "font-semibold text-amber-700 dark:text-amber-300";
    default:
      return "font-semibold text-amber-700 dark:text-amber-300";
  }
}

function errorMessage(code: string): string {
  switch (code) {
    case "forbidden":
      return "No tenés permiso para cobrar este pedido.";
    case "already_paid":
      return "Esta parte o el pedido ya está pagado.";
    case "has_paid_splits":
      return "Ya hay partes pagadas; no se puede redividir.";
    case "not_pedido":
      return "Solo aplica a pedidos.";
    case "cancelled":
      return "El pedido está anulado.";
    case "db":
      return "No se pudo guardar. Intentá de nuevo.";
    default:
      return "No se pudo completar la acción.";
  }
}

export function PedidoCuentaPanel({
  orderId,
  invoiceRef,
  customerName,
  serviceLabel,
  totalCents,
  orderStatus,
  initialBillRequestedAt,
  initialBillPaymentStatus,
  initialSplits,
  lines,
}: {
  orderId: string;
  invoiceRef: string;
  customerName: string;
  serviceLabel: string | null;
  totalCents: number;
  orderStatus: string;
  initialBillRequestedAt: string | null;
  initialBillPaymentStatus: BillPaymentStatus | null;
  initialSplits: PedidoBillSplit[];
  lines: PedidoCuentaLine[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [billRequestedAt, setBillRequestedAt] = useState<string | null>(
    initialBillRequestedAt,
  );
  const [billStatus, setBillStatus] = useState<BillPaymentStatus>(
    initialBillPaymentStatus ??
      (orderStatus === "paid" ? "paid" : "pending"),
  );
  const [splits, setSplits] = useState<PedidoBillSplit[]>(initialSplits);
  const [showFacturita, setShowFacturita] = useState(
    Boolean(initialBillRequestedAt),
  );
  const [payMethod, setPayMethod] = useState<"cash" | "transfer">("cash");
  const [splitParts, setSplitParts] = useState(2);
  const [payingSplitId, setPayingSplitId] = useState<string | null>(null);

  useEffect(() => {
    setBillRequestedAt(initialBillRequestedAt);
    setBillStatus(
      initialBillPaymentStatus ??
        (orderStatus === "paid" ? "paid" : "pending"),
    );
    setSplits(initialSplits);
    if (initialBillRequestedAt) setShowFacturita(true);
  }, [
    initialBillRequestedAt,
    initialBillPaymentStatus,
    initialSplits,
    orderStatus,
  ]);

  const isPaid = orderStatus === "paid" || billStatus === "paid";
  const paidCents = sumPaidSplitCents(splits);
  const pendingCents = Math.max(0, totalCents - paidCents);
  const previewAmounts = equalBillSplitAmounts(totalCents, splitParts);

  function refresh() {
    router.refresh();
  }

  function pedirCuenta() {
    setError(null);
    startTransition(async () => {
      const res = await requestPedidoBill(orderId);
      if (!res.ok) {
        setError(errorMessage(res.error));
        return;
      }
      setBillRequestedAt(res.billRequestedAt);
      setShowFacturita(true);
      if (billStatus !== "paid" && billStatus !== "partial") {
        setBillStatus("pending");
      }
      refresh();
    });
  }

  function dividir() {
    setError(null);
    startTransition(async () => {
      const res = await splitPedidoBillEqual(orderId, splitParts);
      if (!res.ok) {
        setError(errorMessage(res.error));
        return;
      }
      if (!billRequestedAt) {
        setBillRequestedAt(new Date().toISOString());
        setShowFacturita(true);
      }
      setBillStatus("pending");
      refresh();
    });
  }

  function quitarDivision() {
    setError(null);
    startTransition(async () => {
      const res = await clearPedidoBillSplits(orderId);
      if (!res.ok) {
        setError(errorMessage(res.error));
        return;
      }
      setSplits([]);
      setBillStatus("pending");
      refresh();
    });
  }

  function pagar(splitId?: string | null) {
    setError(null);
    setPayingSplitId(splitId ?? null);
    startTransition(async () => {
      const res = await payPedidoBill({
        orderId,
        paymentMethod: payMethod,
        splitId: splitId ?? null,
      });
      setPayingSplitId(null);
      if (!res.ok) {
        setError(errorMessage(res.error));
        return;
      }
      setBillStatus(res.billPaymentStatus);
      if (!billRequestedAt) {
        setBillRequestedAt(new Date().toISOString());
        setShowFacturita(true);
      }
      refresh();
    });
  }

  function imprimirFacturita() {
    setShowFacturita(true);
    window.setTimeout(() => window.print(), 50);
  }

  return (
    <section
      className="print:hidden rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-5"
      data-testid="pedido-cuenta-panel"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Cuenta
          </p>
          <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Cobro del pedido
          </p>
          <p className={`mt-0.5 text-sm ${statusTone(billStatus)}`}>
            {billPaymentStatusLabel(billStatus)}
            {billRequestedAt
              ? ` · cuenta pedida ${formatStoreDateTime(billRequestedAt, {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}`
              : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Total
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
            {formatCop(totalCents)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={pedirCuenta}
          data-testid="pedido-pedir-cuenta"
          className="rounded-lg bg-[var(--admin-coral)] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
        >
          {billRequestedAt ? "Ver facturita" : "Pedir la cuenta"}
        </button>
        {billRequestedAt || showFacturita ? (
          <button
            type="button"
            disabled={pending}
            onClick={imprimirFacturita}
            className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Imprimir facturita
          </button>
        ) : null}
      </div>

      {(showFacturita || billRequestedAt) && (
        <div
          className="mt-4 rounded-xl border border-dashed border-[var(--admin-coral)]/45 bg-[color-mix(in_srgb,var(--admin-coral)_6%,white)] p-4 dark:bg-[color-mix(in_srgb,var(--admin-coral)_12%,#09090b)]"
          data-testid="pedido-facturita"
          id="pedido-facturita"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-coral)]">
                Facturita
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Pedido #{invoiceRef}
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {customerName}
                {serviceLabel ? ` · ${serviceLabel}` : ""}
              </p>
            </div>
            <p className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatCop(totalCents)}
            </p>
          </div>
          <ul className="mt-3 space-y-1.5 border-t border-[var(--admin-coral)]/20 pt-3">
            {lines.map((line, i) => (
              <li
                key={`${line.name}-${i}`}
                className="flex justify-between gap-3 text-sm text-zinc-800 dark:text-zinc-200"
              >
                <span className="min-w-0">
                  <span className="tabular-nums text-zinc-500">
                    {line.quantity}×
                  </span>{" "}
                  {line.name}
                </span>
                <span className="shrink-0 tabular-nums font-medium">
                  {formatCop(line.lineTotalCents)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isPaid ? (
        <div className="mt-5 space-y-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Método
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(
                [
                  ["cash", "Efectivo"],
                  ["transfer", "Transferencia"],
                ] as const
              ).map(([value, label]) => {
                const active = payMethod === value;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={pending}
                    onClick={() => setPayMethod(value)}
                    className={[
                      "rounded-md px-2.5 py-1.5 text-xs font-semibold transition",
                      active
                        ? "bg-[var(--admin-coral)] text-white shadow-sm"
                        : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {splits.length === 0 ? (
            <div className="flex flex-wrap items-end gap-3">
              <button
                type="button"
                disabled={pending || totalCents <= 0}
                onClick={() => pagar(null)}
                data-testid="pedido-pagar"
                className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                Pagar {formatCop(totalCents)}
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Dividir en
                  <select
                    value={splitParts}
                    disabled={pending}
                    onChange={(e) => setSplitParts(Number(e.target.value))}
                    className="ml-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm font-semibold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    {[2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n} partes
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={pending || totalCents <= 0}
                  onClick={dividir}
                  data-testid="pedido-dividir"
                  className="rounded-lg border border-[var(--admin-coral)]/50 px-3.5 py-2 text-sm font-semibold text-[var(--admin-coral)] transition hover:bg-[color-mix(in_srgb,var(--admin-coral)_10%,transparent)] disabled:opacity-60"
                >
                  Dividir la cuenta
                </button>
              </div>
            </div>
          ) : null}

          {splits.length === 0 ? (
            <p className="text-xs text-zinc-500">
              Vista previa:{" "}
              {previewAmounts.map((a, i) => (
                <span key={i} className="tabular-nums">
                  {i > 0 ? " · " : ""}
                  Parte {i + 1} {formatCop(a)}
                </span>
              ))}
            </p>
          ) : (
            <div data-testid="pedido-splits">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Cuentas divididas
                </p>
                {!splits.some((s) => s.paidAt) ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={quitarDivision}
                    className="text-xs font-medium text-zinc-500 underline-offset-2 hover:underline"
                  >
                    Quitar división
                  </button>
                ) : null}
              </div>
              <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Pagado
                  </p>
                  <p className="mt-0.5 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {formatCop(paidCents)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Pendiente
                  </p>
                  <p className="mt-0.5 font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                    {formatCop(pendingCents)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Estado
                  </p>
                  <p className={`mt-0.5 text-sm ${statusTone(billStatus)}`}>
                    {billPaymentStatusLabel(billStatus)}
                  </p>
                </div>
              </div>
              <ul className="space-y-2">
                {splits.map((sp) => {
                  const paid = Boolean(sp.paidAt);
                  return (
                    <li
                      key={sp.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-100 px-3 py-2.5 dark:border-zinc-800"
                      data-testid={`pedido-split-${sp.sortOrder}`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {sp.label}{" "}
                          <span className="tabular-nums font-medium text-zinc-700 dark:text-zinc-300">
                            {formatCop(sp.amountCents)}
                          </span>
                        </p>
                        <p className="text-xs text-zinc-500">
                          {paid
                            ? `Pagada · ${billPaymentMethodLabel(sp.paymentMethod)}`
                            : "Sin pagar"}
                        </p>
                      </div>
                      {paid ? (
                        <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                          Pagada
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => pagar(sp.id)}
                          data-testid={`pedido-pagar-parte-${sp.sortOrder}`}
                          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
                        >
                          {payingSplitId === sp.id && pending
                            ? "Pagando…"
                            : "Pagar"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 border-t border-zinc-100 pt-4 text-sm font-medium text-emerald-700 dark:border-zinc-800 dark:text-emerald-400">
          Pedido pagado por completo.
        </p>
      )}

      {error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
