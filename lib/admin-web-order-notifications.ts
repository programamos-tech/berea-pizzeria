import type { CollaboratorJobRole } from "@/lib/admin-permissions";

export type AdminOrderNotificationKind = "web" | "pedido";

export type AdminWebOrderNotification = {
  id: string;
  kind: AdminOrderNotificationKind;
  customerName: string;
  customerEmail: string;
  totalCents: number;
  createdAt: string;
  checkoutPaymentMethod: string;
  /** Canal del pedido POS: en_el_lugar | domicilio | para_llevar */
  pedidoChannel: string | null;
  read: boolean;
};

const STORAGE_KEY = "admin_order_notification_ids_v2";
const MAX_ITEMS = 40;

export function isWebStorefrontOrder(row: Record<string, unknown>): boolean {
  const ref = String(row.wompi_reference ?? "").trim();
  if (ref.startsWith("POS:")) return false;
  return String(row.status) === "pending";
}

export function isPosPedidoOrder(row: Record<string, unknown>): boolean {
  const ref = String(row.wompi_reference ?? "").trim();
  if (!ref.startsWith("POS:pedido:")) return false;
  const status = String(row.status ?? "");
  return status === "pending" || status === "paid";
}

export function pedidoChannelFromReference(
  wompiReference: string | null | undefined,
): string | null {
  const ref = String(wompiReference ?? "").trim();
  if (!ref.startsWith("POS:pedido:")) return null;
  return ref.slice("POS:pedido:".length) || null;
}

export function pedidoChannelLabel(channel: string | null | undefined): string {
  const c = String(channel ?? "").trim();
  if (c === "en_el_lugar") return "En el lugar";
  if (c === "domicilio") return "Domicilio";
  if (c === "para_llevar") return "Para llevar";
  return "Pedido";
}

export function rowToWebOrderNotification(
  row: Record<string, unknown>,
): AdminWebOrderNotification | null {
  const id = String(row.id ?? "").trim();
  if (!id) return null;

  if (isPosPedidoOrder(row)) {
    // Solo alertar pedidos aún abiertos (no pagados/cerrados).
    if (String(row.status) !== "pending") return null;
    return {
      id,
      kind: "pedido",
      customerName: String(row.customer_name ?? "Cliente"),
      customerEmail: String(row.customer_email ?? ""),
      totalCents: Math.max(0, Number(row.total_cents ?? 0)),
      createdAt: String(row.created_at ?? new Date().toISOString()),
      checkoutPaymentMethod: "pedido",
      pedidoChannel: pedidoChannelFromReference(
        row.wompi_reference != null ? String(row.wompi_reference) : null,
      ),
      read: false,
    };
  }

  if (!isWebStorefrontOrder(row)) return null;
  return {
    id,
    kind: "web",
    customerName: String(row.customer_name ?? "Cliente"),
    customerEmail: String(row.customer_email ?? ""),
    totalCents: Math.max(0, Number(row.total_cents ?? 0)),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    checkoutPaymentMethod: String(row.checkout_payment_method ?? "wompi"),
    pedidoChannel: null,
    read: false,
  };
}

export function loadPersistedNotificationIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ??
      localStorage.getItem("admin_web_order_notification_ids_v1");
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x) => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function persistNotificationIds(ids: Iterable<string>) {
  if (typeof window === "undefined") return;
  try {
    const list = [...ids].slice(-MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function webOrderPaymentLabel(method: string): string {
  return method === "transfer" ? "Transferencia (web)" : "Pago en línea";
}

export function orderNotificationSubtitle(n: AdminWebOrderNotification): string {
  if (n.kind === "pedido") {
    return `${pedidoChannelLabel(n.pedidoChannel)} · ${formatCentsHint(n.totalCents)}`;
  }
  return `${webOrderPaymentLabel(n.checkoutPaymentMethod)} · ${formatCentsHint(n.totalCents)}`;
}

function formatCentsHint(cents: number): string {
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(Math.max(0, cents) / 100);
  } catch {
    return `$${Math.max(0, Math.round(cents / 100))}`;
  }
}

/** Texto del modal según rol (cocina vs salón); genérico para el resto. */
export function newPedidoModalCopy(jobRole: CollaboratorJobRole | null | undefined): {
  title: string;
  body: string;
  cta: string;
} {
  const title = "¡Tienes un nuevo pedido!";
  if (jobRole === "kitchen") {
    return {
      title,
      body: "Entró un pedido nuevo. Revisá la cocina y empezá a prepararlo.",
      cta: "Ver en cocina",
    };
  }
  if (jobRole === "service") {
    return {
      title,
      body: "Entró un pedido nuevo. Revisalo para atender el salón o el domicilio.",
      cta: "Ver pedido",
    };
  }
  return {
    title,
    body: "Hay un pedido nuevo para preparar o servir.",
    cta: "Ver pedido",
  };
}
