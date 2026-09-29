"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  payPedidoBillLines,
  requestPedidoBill,
} from "@/app/actions/admin/pedido-bill";
import { AdminPortalRoot } from "@/components/admin/AdminPortalRoot";
import {
  billPaymentMethodLabel,
  billPaymentStatusLabel,
  sumPaidLineCents,
  sumUnpaidLineCents,
  type BillPaymentStatus,
  type PedidoBillLine,
} from "@/lib/pedido-bill";
import { formatCop } from "@/lib/money";
import { formatStoreDateTime } from "@/lib/store-datetime-format";

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
      return "Hay ítems que ya están pagados. Actualizá la cuenta.";
    case "no_lines":
      return "Este pedido no tiene ítems.";
    case "not_pedido":
      return "Solo aplica a pedidos.";
    case "cancelled":
      return "El pedido está anulado.";
    case "db":
      return "No se pudo guardar. Intentá de nuevo.";
    case "invalid":
      return "Seleccioná al menos un producto pendiente.";
    default:
      return "No se pudo completar el cobro.";
  }
}

export function PedidoCuentaModal({
  orderId,
  invoiceRef,
  customerName,
  serviceLabel,
  totalCents,
  orderStatus,
  initialBillRequestedAt,
  initialBillPaymentStatus,
  initialLines,
}: {
  orderId: string;
  invoiceRef: string;
  customerName: string;
  serviceLabel: string | null;
  totalCents: number;
  orderStatus: string;
  initialBillRequestedAt: string | null;
  initialBillPaymentStatus: BillPaymentStatus | null;
  initialLines: PedidoBillLine[];
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState(initialLines);
  const [billRequestedAt, setBillRequestedAt] = useState(
    initialBillRequestedAt,
  );
  const [billStatus, setBillStatus] = useState<BillPaymentStatus>(
    initialBillPaymentStatus ??
      (orderStatus === "paid" ? "paid" : "pending"),
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [payMethod, setPayMethod] = useState<"cash" | "transfer">("cash");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setLines(initialLines);
    setBillRequestedAt(initialBillRequestedAt);
    setBillStatus(
      initialBillPaymentStatus ??
        (orderStatus === "paid" ? "paid" : "pending"),
    );
    setSelected((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        const line = initialLines.find((l) => l.id === id);
        if (line && !line.billPaidAt) next.add(id);
      }
      return next;
    });
  }, [
    initialLines,
    initialBillRequestedAt,
    initialBillPaymentStatus,
    orderStatus,
  ]);

  const unpaid = useMemo(
    () => lines.filter((l) => !l.billPaidAt),
    [lines],
  );
  const paidCents = sumPaidLineCents(lines);
  const pendingCents = sumUnpaidLineCents(lines);
  const selectedCents = useMemo(() => {
    let s = 0;
    for (const l of lines) {
      if (selected.has(l.id) && !l.billPaidAt) s += l.amountCents;
    }
    return s;
  }, [lines, selected]);
  const isFullyPaid = orderStatus === "paid" || billStatus === "paid";

  function toggle(id: string, paid: boolean) {
    if (paid) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllUnpaid() {
    setSelected(new Set(unpaid.map((l) => l.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function openCuenta() {
    setError(null);
    setOpen(true);
    startTransition(async () => {
      const res = await requestPedidoBill(orderId);
      if (res.ok) {
        setBillRequestedAt(res.billRequestedAt);
      }
    });
  }

  function pagarSeleccion() {
    const ids = [...selected].filter((id) => {
      const line = lines.find((l) => l.id === id);
      return line && !line.billPaidAt;
    });
    if (ids.length === 0) {
      setError(errorMessage("invalid"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await payPedidoBillLines({
        orderId,
        lineIds: ids,
        paymentMethod: payMethod,
      });
      if (!res.ok) {
        setError(errorMessage(res.error));
        return;
      }
      const nowIso = new Date().toISOString();
      setLines((prev) =>
        prev.map((l) =>
          res.paidLineIds.includes(l.id)
            ? {
                ...l,
                billPaidAt: nowIso,
                billPaymentMethod: payMethod,
              }
            : l,
        ),
      );
      setSelected(new Set());
      setBillStatus(res.billPaymentStatus);
      if (!billRequestedAt) setBillRequestedAt(nowIso);
      router.refresh();
    });
  }

  const badgeLabel =
    billStatus === "paid"
      ? "Pagado"
      : billStatus === "partial"
        ? "Parcial"
        : "Cuenta";

  return (
    <>
      <button
        type="button"
        onClick={openCuenta}
        data-testid="pedido-cuenta-btn"
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--admin-coral)] bg-[var(--admin-coral)] px-3 py-1.5 text-sm font-bold tracking-wide text-white shadow-sm transition hover:brightness-105"
      >
        {badgeLabel}
      </button>

      {mounted && open
        ? createPortal(
            <AdminPortalRoot>
              <>
                <button
                  type="button"
                  className="fixed inset-x-0 bottom-0 top-14 z-[100] bg-zinc-950/40 backdrop-blur-sm dark:bg-black/50 sm:top-16 lg:left-64"
                  aria-label="Cerrar"
                  onClick={() => setOpen(false)}
                />
                <div className="pointer-events-none fixed inset-x-0 bottom-0 top-14 z-[101] flex items-center justify-center p-3 sm:top-16 sm:p-6 lg:left-64">
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="pedido-cuenta-modal-title"
                    data-testid="pedido-cuenta-modal"
                    className="pointer-events-auto flex max-h-[min(92dvh,44rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-200/70 px-5 py-4 dark:border-zinc-800">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                          Facturita
                        </p>
                        <h2
                          id="pedido-cuenta-modal-title"
                          className="mt-0.5 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
                        >
                          Cuenta · Pedido #{invoiceRef}
                        </h2>
                        <p className="mt-0.5 text-sm text-zinc-500">
                          {customerName}
                          {serviceLabel ? ` · ${serviceLabel}` : ""}
                        </p>
                        <p className={`mt-1 text-sm ${statusTone(billStatus)}`}>
                          {billPaymentStatusLabel(billStatus)}
                          {billRequestedAt
                            ? ` · ${formatStoreDateTime(billRequestedAt, {
                                day: "numeric",
                                month: "short",
                                hour: "numeric",
                                minute: "2-digit",
                              })}`
                            : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800"
                        aria-label="Cerrar"
                      >
                        <span className="text-xl leading-none" aria-hidden>
                          ×
                        </span>
                      </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                      <div className="grid grid-cols-3 gap-2 rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                            Total
                          </p>
                          <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                            {formatCop(totalCents)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                            Pagado
                          </p>
                          <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                            {formatCop(paidCents)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                            Pendiente
                          </p>
                          <p className="mt-0.5 text-base font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                            {formatCop(pendingCents)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                          Productos
                        </p>
                        {!isFullyPaid && unpaid.length > 0 ? (
                          <div className="flex gap-2 text-xs">
                            <button
                              type="button"
                              onClick={selectAllUnpaid}
                              className="font-medium text-[var(--admin-coral)] underline-offset-2 hover:underline"
                            >
                              Marcar pendientes
                            </button>
                            <button
                              type="button"
                              onClick={clearSelection}
                              className="font-medium text-zinc-500 underline-offset-2 hover:underline"
                            >
                              Limpiar
                            </button>
                          </div>
                        ) : null}
                      </div>

                      <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
                        {lines.map((line) => {
                          const paid = Boolean(line.billPaidAt);
                          const checked = paid || selected.has(line.id);
                          return (
                            <li key={line.id}>
                              <label
                                className={[
                                  "flex cursor-pointer items-start gap-3 py-2.5",
                                  paid ? "cursor-default opacity-70" : "",
                                ].join(" ")}
                                data-testid={`pedido-cuenta-line-${line.id}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={paid || pending}
                                  onChange={() => toggle(line.id, paid)}
                                  className="mt-1 size-4 rounded border-zinc-300 text-[var(--admin-coral)] focus:ring-[var(--admin-coral)] disabled:opacity-60"
                                  data-testid={
                                    paid
                                      ? `pedido-cuenta-paid-${line.id}`
                                      : `pedido-cuenta-check-${line.id}`
                                  }
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                                    <span
                                      className={[
                                        "text-sm font-medium",
                                        paid
                                          ? "text-zinc-500 line-through dark:text-zinc-500"
                                          : "text-zinc-900 dark:text-zinc-100",
                                      ].join(" ")}
                                    >
                                      <span className="tabular-nums text-zinc-500">
                                        {line.quantity}×
                                      </span>{" "}
                                      {line.name}
                                    </span>
                                    <span
                                      className={[
                                        "shrink-0 text-sm tabular-nums font-semibold",
                                        paid
                                          ? "text-zinc-400"
                                          : "text-zinc-900 dark:text-zinc-100",
                                      ].join(" ")}
                                    >
                                      {formatCop(line.amountCents)}
                                    </span>
                                  </span>
                                  {paid ? (
                                    <span className="mt-0.5 block text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                      Pagado ·{" "}
                                      {billPaymentMethodLabel(
                                        line.billPaymentMethod,
                                      )}
                                    </span>
                                  ) : null}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>

                      {error ? (
                        <p
                          className="mt-3 text-sm text-red-600 dark:text-red-400"
                          role="alert"
                        >
                          {error}
                        </p>
                      ) : null}
                    </div>

                    <div className="shrink-0 border-t border-zinc-200/70 px-5 py-4 dark:border-zinc-800">
                      {!isFullyPaid ? (
                        <>
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
                          <button
                            type="button"
                            disabled={pending || selectedCents <= 0}
                            onClick={pagarSeleccion}
                            data-testid="pedido-cuenta-pagar-seleccion"
                            className="mt-3 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                          >
                            {selectedCents > 0
                              ? `Pagar selección · ${formatCop(selectedCents)}`
                              : "Seleccioná productos para pagar"}
                          </button>
                        </>
                      ) : (
                        <p className="text-center text-sm font-medium text-emerald-700 dark:text-emerald-400">
                          Pedido pagado por completo.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            </AdminPortalRoot>,
            document.body,
          )
        : null}
    </>
  );
}
