import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchOrderItemsInChunks,
  fetchOrdersCreatedInReportYmdWindow,
} from "@/lib/admin-fetch-orders-for-report";
import { createdAtBoundsForReportYmdRange } from "@/lib/admin-report-range";

export type ReportTopClient = {
  key: string;
  customerId: string | null;
  name: string;
  orderCount: number;
  totalCents: number;
};

export type ReportTopProduct = {
  key: string;
  productId: string | null;
  name: string;
  quantity: number;
  totalCents: number;
};

export type ReportTopsResult = {
  clients: ReportTopClient[];
  products: ReportTopProduct[];
};

function asCents(v: unknown): number {
  const n = Math.round(Number(v ?? 0));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function asQty(v: unknown): number {
  const n = Math.floor(Number(v ?? 0));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function clientDisplayName(row: {
  customer_id?: unknown;
  customer_name?: unknown;
  customer_email?: unknown;
}): string {
  const name = String(row.customer_name ?? "").trim();
  if (name) return name;
  const email = String(row.customer_email ?? "").trim();
  if (email) return email;
  return "Cliente mostrador";
}

function parseTopsRpc(raw: unknown): ReportTopsResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { clients?: unknown; products?: unknown };
  if (!Array.isArray(r.clients) || !Array.isArray(r.products)) return null;
  return {
    clients: (r.clients as Record<string, unknown>[]).map((c) => ({
      key: String(c.key ?? ""),
      customerId: c.customerId != null ? String(c.customerId) : null,
      name: String(c.name ?? ""),
      orderCount: Math.max(0, Math.floor(Number(c.orderCount ?? 0))),
      totalCents: asCents(c.totalCents),
    })),
    products: (r.products as Record<string, unknown>[]).map((p) => ({
      key: String(p.key ?? ""),
      productId: p.productId != null ? String(p.productId) : null,
      name: String(p.name ?? ""),
      quantity: asQty(p.quantity),
      totalCents: asCents(p.totalCents),
    })),
  };
}

/**
 * Top clientes y productos en el rango de reportes (pedidos pagados).
 */
export async function fetchAdminReportTops(
  supabase: SupabaseClient,
  fromYmd: string,
  toYmd: string,
  limit = 5,
): Promise<ReportTopsResult> {
  const lim = Math.min(12, Math.max(3, Math.trunc(limit)));
  const bounds = createdAtBoundsForReportYmdRange(fromYmd, toYmd);
  if (!bounds) return { clients: [], products: [] };

  const { data: rpcData, error: rpcError } = await supabase.rpc("admin_report_tops", {
    p_gte: bounds.gte,
    p_lt: bounds.lt,
    p_limit: lim,
  });
  const fromRpc = rpcError ? null : parseTopsRpc(rpcData);
  if (fromRpc) return fromRpc;
  if (rpcError) console.error("[admin reportes] tops rpc:", rpcError.message);

  const { rows: orderRows, error } = await fetchOrdersCreatedInReportYmdWindow(
    supabase,
    fromYmd,
    toYmd,
    "id,status,total_cents,customer_id,customer_name,customer_email",
  );
  if (error) {
    console.error("[admin reportes] tops orders:", error);
    return { clients: [], products: [] };
  }

  const paid = orderRows.filter((o) => String(o.status ?? "") === "paid");
  if (paid.length === 0) return { clients: [], products: [] };

  const clientMap = new Map<
    string,
    { customerId: string | null; name: string; orderCount: number; totalCents: number }
  >();
  for (const o of paid) {
    const customerId =
      o.customer_id != null && String(o.customer_id).trim()
        ? String(o.customer_id)
        : null;
    const name = clientDisplayName(o);
    const key = customerId ?? `name:${name.toLowerCase()}`;
    const cur = clientMap.get(key) ?? {
      customerId,
      name,
      orderCount: 0,
      totalCents: 0,
    };
    cur.orderCount += 1;
    cur.totalCents += asCents(o.total_cents);
    if (name && (cur.name === "Cliente mostrador" || name.length > cur.name.length)) {
      cur.name = name;
    }
    clientMap.set(key, cur);
  }

  const clients = [...clientMap.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.totalCents - a.totalCents || b.orderCount - a.orderCount)
    .slice(0, lim);

  const paidIds = paid.map((o) => String(o.id));
  const { rows: itemRows, error: itemsErr } = await fetchOrderItemsInChunks(
    supabase,
    paidIds,
    "product_id,product_name_snapshot,quantity,unit_price_cents",
  );
  if (itemsErr) {
    console.error("[admin reportes] tops items:", itemsErr);
    return { clients, products: [] };
  }

  const productMap = new Map<
    string,
    { productId: string | null; name: string; quantity: number; totalCents: number }
  >();
  for (const it of itemRows) {
    const productId =
      it.product_id != null && String(it.product_id).trim()
        ? String(it.product_id)
        : null;
    const name = String(it.product_name_snapshot ?? "Producto").trim() || "Producto";
    const key = productId ?? `name:${name.toLowerCase()}`;
    const qty = asQty(it.quantity);
    const line = qty * asCents(it.unit_price_cents);
    const cur = productMap.get(key) ?? {
      productId,
      name,
      quantity: 0,
      totalCents: 0,
    };
    cur.quantity += qty;
    cur.totalCents += line;
    if (name.length > cur.name.length) cur.name = name;
    productMap.set(key, cur);
  }

  const products = [...productMap.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.totalCents - a.totalCents || b.quantity - a.quantity)
    .slice(0, lim);

  return { clients, products };
}
