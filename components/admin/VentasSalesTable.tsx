"use client";

import Link from "next/link";
import { Armchair, Bike, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  formatVentaFecha,
  ventaNumeroReferencia,
} from "@/lib/ventas-sales";
import { kitchenStatusTone } from "@/lib/kitchen-status";
import { billPaymentStatusTone } from "@/lib/pedido-bill";
import { StaticCopCents } from "@/components/admin/ReportsAnimatedFigures";
import type { VentaOrderRow } from "@/lib/supabase/admin-ventas-list";

const thClass =
  "pb-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500";

function PedidoTipoBadge({
  serviceType,
  mesaLabel,
  compact = false,
}: {
  serviceType: "domicilio" | "en_el_lugar" | null;
  mesaLabel: string | null;
  compact?: boolean;
}) {
  if (serviceType === "domicilio") {
    return (
      <span
        className={[
          "inline-flex items-center gap-1 rounded-md bg-[var(--admin-coral)] font-bold tracking-wide text-white shadow-sm",
          compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        ].join(" ")}
      >
        <Bike
          className={compact ? "size-3 shrink-0" : "size-3.5 shrink-0"}
          strokeWidth={2.4}
          aria-hidden
        />
        Domicilio
      </span>
    );
  }
  if (serviceType === "en_el_lugar") {
    return (
      <span
        className={[
          "inline-flex items-center gap-1 rounded-md bg-teal-700 font-bold tracking-wide text-white shadow-sm dark:bg-teal-600",
          compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        ].join(" ")}
      >
        <Armchair
          className={compact ? "size-3 shrink-0" : "size-3.5 shrink-0"}
          strokeWidth={2.4}
          aria-hidden
        />
        {mesaLabel ? `Mesa ${mesaLabel}` : "En el lugar"}
      </span>
    );
  }
  return (
    <span className="text-xs text-zinc-400 dark:text-zinc-500">—</span>
  );
}

export function VentasSalesTable({
  rows,
  orderListReturnHref,
}: {
  rows: VentaOrderRow[];
  /** Si se pasa, el detalle del pedido vuelve a este listado (misma página y filtros). */
  orderListReturnHref?: string;
}) {
  const router = useRouter();

  const orderDetailHref = (orderId: string) =>
    orderListReturnHref
      ? `/admin/orders/${orderId}?returnTo=${encodeURIComponent(orderListReturnHref)}`
      : `/admin/orders/${orderId}`;

  if (rows.length === 0) {
    return (
      <p className="py-8 text-sm text-zinc-500 dark:text-zinc-400">
        No hay pedidos que coincidan con los filtros.
      </p>
    );
  }

  return (
    <>
      {/* Móvil / tablet: lista plana */}
      <ul
        role="list"
        className="divide-y divide-zinc-100 xl:hidden dark:divide-zinc-800"
      >
        {rows.map((row) => {
          const ref = ventaNumeroReferencia(
            row.id,
            row.wompi_transaction_id ?? null,
          );
          const cocina = row.kitchen_status
            ? kitchenStatusTone(row.kitchen_status, row.service_type)
            : null;
          const pago = row.bill_payment_status
            ? billPaymentStatusTone(row.bill_payment_status)
            : null;
          const href = orderDetailHref(row.id);

          return (
            <li key={row.id} className="min-w-0">
              <Link
                href={href}
                className="flex items-start justify-between gap-3 py-3 no-underline transition hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40"
                aria-label={`Ver pedido ${ref}, ${row.customer_name}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      #{ref}
                    </p>
                    <PedidoTipoBadge
                      serviceType={row.service_type}
                      mesaLabel={row.mesa_label}
                      compact
                    />
                  </div>
                  <p className="mt-0.5 truncate text-sm text-zinc-800 dark:text-zinc-200">
                    {row.customer_name}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {cocina ? (
                      <span className={cocina.className}>{cocina.label}</span>
                    ) : null}
                    {pago ? (
                      <span className={`text-xs ${pago.className}`}>
                        {pago.label}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {formatVentaFecha(row.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <p className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                    <StaticCopCents cents={Number(row.total_cents ?? 0)} />
                  </p>
                  <span
                    className="inline-flex size-8 items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400"
                    aria-hidden
                  >
                    <Eye className="size-4" strokeWidth={2} />
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Desktop: Pedido · Total · Cliente · Tipo · Cocina · Pago · Fecha · ver */}
      <div className="hidden min-w-0 overflow-x-auto xl:block">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200/70 dark:border-zinc-800">
              <th className={thClass}>Pedido</th>
              <th className={`${thClass} text-right`}>Total</th>
              <th className={thClass}>Cliente</th>
              <th className={thClass}>Tipo</th>
              <th className={thClass}>Cocina</th>
              <th className={thClass}>Pago</th>
              <th className={thClass}>Fecha</th>
              <th className={`${thClass} w-10 pr-0`} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const href = orderDetailHref(row.id);
              const ref = ventaNumeroReferencia(
                row.id,
                row.wompi_transaction_id ?? null,
              );
              const cocina = row.kitchen_status
                ? kitchenStatusTone(row.kitchen_status, row.service_type)
                : null;
              const pago = row.bill_payment_status
                ? billPaymentStatusTone(row.bill_payment_status)
                : null;
              return (
                <tr
                  key={row.id}
                  tabIndex={0}
                  aria-label={`Ver pedido ${ref}, ${row.customer_name}`}
                  className="cursor-pointer border-b border-zinc-100/80 last:border-0 transition hover:bg-zinc-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:border-zinc-800/80 dark:hover:bg-zinc-900/40"
                  onClick={() => {
                    router.push(href);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(href);
                    }
                  }}
                >
                  <td className="py-2.5 pr-4">
                    <span className="font-mono text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      #{ref}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-4 text-right tabular-nums font-semibold text-zinc-900 dark:text-zinc-50">
                    <StaticCopCents cents={Number(row.total_cents ?? 0)} />
                  </td>
                  <td className="max-w-[12rem] truncate py-2.5 pr-4 text-zinc-900 dark:text-zinc-100">
                    {row.customer_name}
                  </td>
                  <td className="py-2.5 pr-4">
                    <PedidoTipoBadge
                      serviceType={row.service_type}
                      mesaLabel={row.mesa_label}
                    />
                  </td>
                  <td className="py-2.5 pr-4">
                    {cocina ? (
                      <span className={cocina.className}>{cocina.label}</span>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-xs">
                    {pago ? (
                      <span className={pago.className}>{pago.label}</span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-4 text-xs text-zinc-500 dark:text-zinc-400">
                    {formatVentaFecha(row.created_at)}
                  </td>
                  <td className="py-2.5 text-right">
                    <Link
                      href={href}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="inline-flex size-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      aria-label={`Ver detalle del pedido ${ref}`}
                      title="Ver"
                    >
                      <Eye className="size-4" strokeWidth={2} aria-hidden />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
