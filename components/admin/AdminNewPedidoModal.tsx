"use client";

import Link from "next/link";
import { useAdminOrderNotifications } from "@/components/admin/AdminOrderNotificationsProvider";
import {
  newPedidoModalCopy,
  pedidoChannelLabel,
} from "@/lib/admin-web-order-notifications";
import { formatCop } from "@/lib/money";
import { ventaNumeroReferencia } from "@/lib/ventas-sales";

export function AdminNewPedidoModal() {
  const { modalPedido, dismissModal, jobRole } = useAdminOrderNotifications();
  if (!modalPedido) return null;

  const copy = newPedidoModalCopy(jobRole);
  const href = `/admin/orders/${modalPedido.id}`;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-zinc-950/40 p-4 backdrop-blur-[1px] sm:items-center dark:bg-black/50"
      role="presentation"
      data-testid="pedido-nuevo-modal-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pedido-nuevo-modal-title"
        data-testid="pedido-nuevo-modal"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="border-b border-zinc-100 bg-[color-mix(in_srgb,var(--admin-coral)_12%,white)] px-5 py-4 dark:border-zinc-800 dark:bg-[color-mix(in_srgb,var(--admin-coral)_18%,#18181b)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-coral-deep)] dark:text-[var(--admin-coral)]">
            {jobRole === "kitchen"
              ? "Cocina"
              : jobRole === "service"
                ? "Salón / servicio"
                : "Pedidos"}
          </p>
          <h2
            id="pedido-nuevo-modal-title"
            className="mt-1 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            {copy.title}
          </h2>
          <p className="mt-1.5 text-sm leading-snug text-zinc-600 dark:text-zinc-300">
            {copy.body}
          </p>
        </div>

        <div className="space-y-1 px-5 py-4">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            #{ventaNumeroReferencia(modalPedido.id)} · {modalPedido.customerName}
          </p>
          <p className="text-sm text-zinc-500">
            {pedidoChannelLabel(modalPedido.pedidoChannel)} ·{" "}
            {formatCop(modalPedido.totalCents)}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 px-5 py-4 sm:flex-row sm:justify-end dark:border-zinc-800">
          <button
            type="button"
            onClick={dismissModal}
            data-testid="pedido-nuevo-modal-cerrar"
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Cerrar
          </button>
          <Link
            href={href}
            onClick={dismissModal}
            data-testid="pedido-nuevo-modal-ver"
            className="inline-flex items-center justify-center rounded-lg bg-[var(--admin-coral)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--admin-coral-hover)]"
          >
            {copy.cta}
          </Link>
        </div>
      </div>
    </div>
  );
}
