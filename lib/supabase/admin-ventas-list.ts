import type { SupabaseClient } from "@supabase/supabase-js";
import { createdAtBoundsForReportYmdRange } from "@/lib/admin-report-range";
import {
  isBillPaymentStatus,
  type BillPaymentStatus,
} from "@/lib/pedido-bill";
import {
  isKitchenStatus,
  type KitchenStatus,
} from "@/lib/kitchen-status";
import type { VentaEstadoFilter, VentaPagoFilter } from "@/lib/ventas-sales";

export type VentaOrderRow = {
  id: string;
  status: string;
  customer_name: string;
  total_cents: number;
  created_at: string;
  wompi_reference: string | null;
  wompi_transaction_id: string | null;
  customer_email: string | null;
  service_type: "domicilio" | "en_el_lugar" | null;
  kitchen_status: KitchenStatus | null;
  bill_payment_status: BillPaymentStatus | null;
  /** Código/nombre de mesa si el pedido es en el lugar. */
  mesa_label: string | null;
};

/** Columnas del listado Pedidos (salón / domicilio). */
const VENTAS_SELECT =
  "id,status,customer_name,total_cents,created_at,wompi_reference,wompi_transaction_id,customer_email,service_type,kitchen_status,bill_payment_status";

type VentasFilterOpts = {
  q?: string;
  status: VentaEstadoFilter;
  payment: VentaPagoFilter;
  dateFrom: string | null;
  dateTo: string | null;
};

function sanitizeIlikeQuery(q: string): string {
  return q.replace(/[%_\\,]/g, "").trim().slice(0, 80);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyVentaPagoFilter(query: any, payment: VentaPagoFilter) {
  if (payment === "all") return query;
  if (payment === "cash") {
    return query.eq("wompi_reference", "POS:cash");
  }
  if (payment === "transfer") {
    return query.eq("wompi_reference", "POS:transfer");
  }
  if (payment === "mixed") {
    return query.eq("wompi_reference", "POS:mixed");
  }
  if (payment === "credit") {
    return query.eq("wompi_reference", "POS:credit");
  }
  if (payment === "online") {
    return query.not("wompi_reference", "like", "POS:%");
  }
  return query;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyVentaTextFilter(query: any, q: string) {
  const term = sanitizeIlikeQuery(q);
  if (!term) return query;
  const pattern = `%${term}%`;
  const compact = term.replace(/-/g, "").toLowerCase();
  const orParts = [
    `customer_name.ilike.${pattern}`,
    `customer_email.ilike.${pattern}`,
  ];
  if (/^[0-9a-f-]{8,}$/i.test(term)) {
    orParts.push(`id.ilike.%${compact}%`);
  }
  return query.or(orParts.join(","));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyVentasFilters(query: any, opts: VentasFilterOpts) {
  if (opts.dateFrom || opts.dateTo) {
    const lo = opts.dateFrom ?? "1970-01-01";
    const hi = opts.dateTo ?? opts.dateFrom ?? "1970-01-01";
    const fromYmd = lo <= hi ? lo : hi;
    const toYmd = lo <= hi ? hi : lo;
    const bounds = createdAtBoundsForReportYmdRange(fromYmd, toYmd);
    if (bounds) {
      query = query.gte("created_at", bounds.gte).lt("created_at", bounds.lt);
    }
  }

  if (opts.status !== "all") {
    query = query.eq("status", opts.status);
  }

  query = applyVentaPagoFilter(query, opts.payment);

  if (opts.q?.trim()) {
    query = applyVentaTextFilter(query, opts.q);
  }

  return query;
}

export type FetchAdminVentasPageOpts = VentasFilterOpts & {
  page: number;
  pageSize: number;
};

export type FetchAdminVentasPageResult = {
  rows: VentaOrderRow[];
  total: number;
  error: string | null;
};

function mapVentaRow(raw: Record<string, unknown>): VentaOrderRow {
  const ref =
    raw.wompi_reference != null ? String(raw.wompi_reference) : null;
  const isPedido = Boolean(ref?.startsWith("POS:pedido:"));
  const serviceRaw =
    raw.service_type != null ? String(raw.service_type) : null;
  const service_type =
    serviceRaw === "domicilio" || serviceRaw === "en_el_lugar"
      ? serviceRaw
      : null;
  const kitchenRaw =
    raw.kitchen_status != null ? String(raw.kitchen_status) : "";
  let kitchen_status: KitchenStatus | null = null;
  if (isPedido) {
    kitchen_status = isKitchenStatus(kitchenRaw) ? kitchenRaw : "recibido";
  }
  const billRaw =
    raw.bill_payment_status != null
      ? String(raw.bill_payment_status)
      : null;
  let bill_payment_status: BillPaymentStatus | null = null;
  if (isPedido) {
    if (isBillPaymentStatus(billRaw ?? "")) {
      bill_payment_status = billRaw as BillPaymentStatus;
    } else if (String(raw.status) === "paid") {
      bill_payment_status = "paid";
    } else {
      bill_payment_status = "pending";
    }
  }

  return {
    id: String(raw.id),
    status: String(raw.status ?? ""),
    customer_name: String(raw.customer_name ?? ""),
    total_cents: Number(raw.total_cents ?? 0),
    created_at: String(raw.created_at ?? ""),
    wompi_reference: ref,
    wompi_transaction_id:
      raw.wompi_transaction_id != null
        ? String(raw.wompi_transaction_id)
        : null,
    customer_email:
      raw.customer_email != null ? String(raw.customer_email) : null,
    service_type,
    kitchen_status,
    bill_payment_status,
    mesa_label: null,
  };
}

async function attachMesaLabels(
  supabase: SupabaseClient,
  rows: VentaOrderRow[],
): Promise<VentaOrderRow[]> {
  const placeIds = rows
    .filter(
      (r) =>
        r.wompi_reference?.startsWith("POS:pedido:") &&
        r.service_type === "en_el_lugar",
    )
    .map((r) => r.id);
  if (placeIds.length === 0) return rows;

  const { data } = await supabase
    .from("dining_table_sessions")
    .select("order_id, opened_at, dining_tables(code, name)")
    .in("order_id", placeIds)
    .order("opened_at", { ascending: false });

  const mesaByOrder = new Map<string, string>();
  for (const sess of data ?? []) {
    const oid = sess.order_id != null ? String(sess.order_id) : "";
    if (!oid || mesaByOrder.has(oid)) continue;
    const tables = sess.dining_tables as
      | { code?: string | null; name?: string | null }
      | { code?: string | null; name?: string | null }[]
      | null;
    const table = Array.isArray(tables) ? tables[0] : tables;
    const code = table?.code != null ? String(table.code).trim() : "";
    const name = table?.name != null ? String(table.name).trim() : "";
    const label = code || name;
    if (label) mesaByOrder.set(oid, label);
  }

  return rows.map((r) =>
    mesaByOrder.has(r.id)
      ? { ...r, mesa_label: mesaByOrder.get(r.id) ?? null }
      : r,
  );
}

export async function fetchAdminVentasPage(
  supabase: SupabaseClient,
  opts: FetchAdminVentasPageOpts,
): Promise<FetchAdminVentasPageResult> {
  const safePage = Math.max(1, Math.floor(opts.page));
  const safeSize = Math.min(100, Math.max(1, Math.floor(opts.pageSize)));
  const from = (safePage - 1) * safeSize;
  const to = from + safeSize - 1;

  const listRes = await applyVentasFilters(
    supabase
      .from("orders")
      .select(VENTAS_SELECT, { count: "estimated" })
      .like("wompi_reference", "POS:pedido:%"),
    opts,
  )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (listRes.error) {
    return {
      rows: [],
      total: 0,
      error: listRes.error.message,
    };
  }

  const mapped = ((listRes.data ?? []) as Record<string, unknown>[]).map(
    mapVentaRow,
  );
  const rows = await attachMesaLabels(supabase, mapped);

  return {
    rows,
    total: listRes.count ?? 0,
    error: null,
  };
}
