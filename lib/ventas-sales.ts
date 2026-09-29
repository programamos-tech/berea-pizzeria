import { isPosCreditSale } from "@/lib/order-credit";
import { formatStoreVentaFecha } from "@/lib/store-datetime-format";

/** Ventas POS marcan método en `wompi_reference` con prefijo `POS:`. */
export function isVentaFisica(wompiReference: string | null | undefined): boolean {
  const r = wompiReference?.trim() ?? "";
  return r.startsWith("POS:");
}

/** Cotización POS: no descuenta ni debe reponer stock al anular. */
export function isPosQuotation(wompiReference: string | null | undefined): boolean {
  return (wompiReference?.trim() ?? "") === "POS:quotation";
}

/** Venta de mostrador ya cobrada (no cotización). */
export function isPosPaidSale(wompiReference: string | null | undefined): boolean {
  const r = wompiReference?.trim() ?? "";
  return r.startsWith("POS:") && r !== "POS:quotation";
}

export type VentaFormaPagoOpts = {
  checkoutPaymentMethod?: string | null;
};

export function ventaFormaPagoLabel(
  wompiReference: string | null | undefined,
  opts?: VentaFormaPagoOpts,
): string {
  const r = wompiReference?.trim() ?? "";
  if (r === "POS:cash") return "Efectivo";
  if (r === "POS:transfer") return "Transferencia";
  if (r === "POS:mixed") return "Mixto";
  if (r === "POS:credit") return "Crédito";
  if (r === "POS:quotation") return "Cotización";
  if (r.startsWith("POS:pedido:")) return "Pedido";
  if (r.startsWith("POS:")) return "Mostrador";
  if (opts?.checkoutPaymentMethod === "transfer") return "Transferencia (web)";
  return "En línea";
}

/** Pill de forma de pago (neutros — sin lluvia de ámbar/coral). */
export function ventaFormaPagoBadge(
  wompiReference: string | null | undefined,
  opts?: VentaFormaPagoOpts,
): { label: string; className: string } {
  const r = wompiReference?.trim() ?? "";
  if (r === "POS:cash") {
    return {
      label: "Efectivo",
      className:
        "bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200/80 dark:bg-zinc-800/80 dark:text-zinc-100 dark:ring-zinc-600/70",
    };
  }
  if (r === "POS:transfer") {
    return {
      label: "Transferencia",
      className:
        "bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200/80 dark:bg-zinc-800/80 dark:text-zinc-100 dark:ring-zinc-600/70",
    };
  }
  if (r === "POS:mixed") {
    return {
      label: "Mixto",
      className:
        "bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200/80 dark:bg-zinc-800/80 dark:text-zinc-100 dark:ring-zinc-600/70",
    };
  }
  if (r === "POS:credit") {
    return {
      label: "Crédito",
      className:
        "bg-orange-50 text-orange-800 ring-1 ring-orange-200/90 dark:bg-orange-950/45 dark:text-orange-100 dark:ring-orange-800/50",
    };
  }
  if (r === "POS:quotation") {
    return {
      label: "Cotización",
      className:
        "bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200/80 dark:bg-zinc-800/80 dark:text-zinc-100 dark:ring-zinc-600/70",
    };
  }
  if (r.startsWith("POS:pedido:")) {
    return {
      label: "Pedido",
      className:
        "bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200/80 dark:bg-zinc-800/80 dark:text-zinc-100 dark:ring-zinc-600/70",
    };
  }
  if (r.startsWith("POS:")) {
    return {
      label: "Mostrador",
      className:
        "bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200/80 dark:bg-zinc-800/80 dark:text-zinc-100 dark:ring-zinc-600/70",
    };
  }
  if (opts?.checkoutPaymentMethod === "transfer") {
    return {
      label: "Transferencia (web)",
      className:
        "bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200/80 dark:bg-zinc-800/80 dark:text-zinc-100 dark:ring-zinc-600/70",
    };
  }
  return {
    label: "En línea",
    className:
      "bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200/80 dark:bg-zinc-800/80 dark:text-zinc-100 dark:ring-zinc-600/70",
  };
}

/** Crédito en listados y detalle: un solo naranja bold, como Pagado en verde. */
export const ventaCreditoToneClass =
  "font-semibold text-orange-600 dark:text-orange-400";

/** Color de letra (sin pastilla), para listados limpios. */
export function ventaFormaPagoTone(
  wompiReference: string | null | undefined,
  opts?: VentaFormaPagoOpts,
): { label: string; className: string } {
  const { label } = ventaFormaPagoBadge(wompiReference, opts);
  const r = wompiReference?.trim() ?? "";
  if (r === "POS:credit") {
    return {
      label,
      className: ventaCreditoToneClass,
    };
  }
  if (r === "POS:quotation") {
    return {
      label,
      className: "font-medium text-violet-700 dark:text-violet-300",
    };
  }
  return {
    label,
    className: "font-medium text-sky-700 dark:text-sky-300",
  };
}

export type VentaPagoFilter =
  | "all"
  | "cash"
  | "transfer"
  | "mixed"
  | "credit"
  | "online";

export function matchesVentaPagoFilter(
  wompiReference: string | null | undefined,
  filter: VentaPagoFilter,
  opts?: VentaFormaPagoOpts,
): boolean {
  if (filter === "all") return true;
  const r = wompiReference?.trim() ?? "";
  const fisica = r.startsWith("POS:");
  if (filter === "online") {
    if (fisica) return false;
    if (opts?.checkoutPaymentMethod === "transfer") return false;
    return true;
  }
  if (filter === "cash") return r === "POS:cash";
  if (filter === "transfer") {
    if (r === "POS:transfer") return true;
    if (opts?.checkoutPaymentMethod === "transfer") return true;
    return false;
  }
  if (filter === "mixed") return r === "POS:mixed";
  if (filter === "credit") return r === "POS:credit";
  return true;
}

export type VentaEstadoFilter =
  | "all"
  | "paid"
  | "cancelled"
  | "pending"
  | "failed"
  | "quotation";

/** Estado del cobro (columna distinta al ciclo de factura en el detalle). */
export function ventaPagoRecibidoBadge(status: string): { label: string; className: string } {
  switch (status) {
    case "paid":
      return {
        label: "Pagado",
        className:
          "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/90 dark:bg-emerald-950/45 dark:text-emerald-100 dark:ring-emerald-700/50",
      };
    case "quotation":
      return {
        label: "Sin cobro (cotización)",
        className:
          "bg-violet-50 text-violet-900 ring-1 ring-violet-200/90 dark:bg-violet-950/45 dark:text-violet-100 dark:ring-violet-700/50",
      };
    case "pending":
      return {
        label: "Pendiente",
        className:
          "bg-amber-50 text-amber-900 ring-1 ring-amber-100 dark:bg-amber-950/45 dark:text-amber-100 dark:ring-amber-800/50",
      };
    case "failed":
      return {
        label: "Fallido",
        className:
          "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200/80 dark:bg-zinc-800/80 dark:text-zinc-300 dark:ring-zinc-600/70",
      };
    case "cancelled":
      return {
        label: "Cancelado",
        className:
          "bg-red-50 text-red-700 ring-1 ring-red-100 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-800/50",
      };
    default:
      return {
        label: status,
        className:
          "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200/80 dark:bg-zinc-800/80 dark:text-zinc-200 dark:ring-zinc-600/70",
      };
  }
}

/** Color de letra + bold (sin pastilla). */
export function ventaPagoRecibidoTone(
  status: string,
  wompiReference?: string | null,
  creditPendingCents?: number,
): {
  label: string;
  className: string;
} {
  let cobroStatus = status;
  if (isPosCreditSale(wompiReference) && status !== "cancelled") {
    cobroStatus = (creditPendingCents ?? 0) > 0 ? "pending" : "paid";
  }
  const { label } = ventaPagoRecibidoBadge(cobroStatus);
  switch (cobroStatus) {
    case "paid":
      return {
        label,
        className: "font-semibold text-emerald-700 dark:text-emerald-400",
      };
    case "quotation":
      return {
        label,
        className: "font-semibold text-violet-700 dark:text-violet-300",
      };
    case "pending":
      return {
        label,
        className: "font-semibold text-amber-700 dark:text-amber-300",
      };
    case "failed":
      return {
        label,
        className: "font-semibold text-zinc-500 dark:text-zinc-400",
      };
    case "cancelled":
      return {
        label,
        className: "font-semibold text-red-600 dark:text-red-400",
      };
    default:
      return {
        label,
        className: "font-semibold text-zinc-700 dark:text-zinc-300",
      };
  }
}

export function ventaEstadoBadge(status: string): { label: string; className: string } {
  switch (status) {
    case "paid":
      return {
        label: "Finalizada",
        className:
          "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/90 dark:bg-emerald-950/45 dark:text-emerald-100 dark:ring-emerald-700/50",
      };
    case "quotation":
      return {
        label: "Cotización",
        className:
          "bg-violet-50 text-violet-900 ring-1 ring-violet-200/90 dark:bg-violet-950/45 dark:text-violet-100 dark:ring-violet-700/50",
      };
    case "cancelled":
      return {
        label: "Anulada",
        className:
          "bg-red-50 text-red-700 ring-1 ring-red-100 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-800/50",
      };
    case "pending":
      return {
        label: "Pendiente",
        className:
          "bg-amber-50 text-amber-900 ring-1 ring-amber-100 dark:bg-amber-950/45 dark:text-amber-100 dark:ring-amber-800/50",
      };
    case "failed":
      return {
        label: "Fallida",
        className:
          "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200/80 dark:bg-zinc-800/80 dark:text-zinc-300 dark:ring-zinc-600/70",
      };
    default:
      return {
        label: status,
        className:
          "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200/80 dark:bg-zinc-800/80 dark:text-zinc-200 dark:ring-zinc-600/70",
      };
  }
}

/** Color de letra + bold (sin pastilla), para listados limpios. */
export function ventaEstadoTone(status: string): { label: string; className: string } {
  const { label } = ventaEstadoBadge(status);
  switch (status) {
    case "paid":
      return { label, className: "font-semibold text-emerald-700 dark:text-emerald-400" };
    case "quotation":
      return { label, className: "font-semibold text-violet-700 dark:text-violet-300" };
    case "cancelled":
      return { label, className: "font-semibold text-red-600 dark:text-red-400" };
    case "pending":
      return { label, className: "font-semibold text-amber-700 dark:text-amber-300" };
    case "failed":
      return { label, className: "font-semibold text-zinc-500 dark:text-zinc-400" };
    default:
      return { label, className: "font-semibold text-zinc-700 dark:text-zinc-300" };
  }
}

/** Número corto legible para la columna factura/pedido.
 * Pedidos migrados (Nou) guardan el correlativo en `wompi_transaction_id`.
 */
export function ventaNumeroReferencia(
  id: string,
  legacyInvoice?: string | null,
): string {
  const legacy = String(legacyInvoice ?? "").trim();
  const nou = /(?:^|:)NOU:(\d+)/.exec(legacy);
  if (nou?.[1]) return nou[1];
  if (/^\d{1,10}$/.test(legacy)) return legacy;
  const hex = id.replace(/-/g, "").slice(-10);
  const n = parseInt(hex.slice(0, 8), 16);
  if (!Number.isFinite(n)) return id.replace(/-/g, "").slice(0, 8).toUpperCase();
  return String(n % 100000).padStart(5, "0");
}

export function formatVentaFecha(iso: string | null | undefined): string {
  return formatStoreVentaFecha(iso);
}
