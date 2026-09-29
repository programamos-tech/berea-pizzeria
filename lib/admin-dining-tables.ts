import type { SupabaseClient } from "@supabase/supabase-js";

export type DiningTableRow = {
  id: string;
  name: string;
  code: string;
  seats: number;
  sortOrder: number;
};

export type DiningTableWithSession = DiningTableRow & {
  openSession: {
    id: string;
    openedAt: string;
    guestCount: number | null;
    note: string | null;
    /** Pedido POS en el lugar que ocupa la mesa. */
    orderId: string;
  } | null;
};

export type DiningTablesBoard = {
  /** Todas las mesas activas, orden de salón. */
  all: DiningTableWithSession[];
  available: DiningTableWithSession[];
  occupied: DiningTableWithSession[];
};

function isLiveSalonPedido(order: {
  id?: string | null;
  status?: string | null;
  wompi_reference?: string | null;
  service_type?: string | null;
} | null | undefined): boolean {
  if (!order?.id) return false;
  const ref =
    order.wompi_reference != null ? String(order.wompi_reference) : "";
  if (!ref.startsWith("POS:pedido:")) return false;
  if (String(order.service_type ?? "") !== "en_el_lugar") return false;
  const st = String(order.status ?? "");
  if (st === "paid" || st === "cancelled" || st === "refunded") return false;
  return true;
}

/**
 * Mesas del salón: ocupada solo si hay sesión open ligada a un pedido
 * en el lugar aún no pagado / no anulado. Cierra sesiones huérfanas
 * (seed demo sin pedido, pedidos ya pagados, etc.).
 */
export async function fetchDiningTablesBoard(
  supabase: SupabaseClient,
  branchId: string,
): Promise<DiningTablesBoard> {
  const { data: tables, error } = await supabase
    .from("dining_tables")
    .select("id, name, code, seats, sort_order")
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[mesas] tables:", error.message);
    return { all: [], available: [], occupied: [] };
  }

  const ids = (tables ?? []).map((t) => String(t.id));
  if (ids.length === 0) return { all: [], available: [], occupied: [] };

  const { data: sessions, error: sessErr } = await supabase
    .from("dining_table_sessions")
    .select("id, dining_table_id, opened_at, guest_count, note, order_id")
    .eq("status", "open")
    .in("dining_table_id", ids);

  if (sessErr) {
    console.error("[mesas] sessions:", sessErr.message);
  }

  const orderIds = [
    ...new Set(
      (sessions ?? [])
        .map((s) => (s.order_id != null ? String(s.order_id) : ""))
        .filter((id) => id.length > 0),
    ),
  ];

  const ordersById = new Map<
    string,
    {
      id: string;
      status: string | null;
      wompi_reference: string | null;
      service_type: string | null;
    }
  >();

  if (orderIds.length > 0) {
    const { data: orders, error: ordErr } = await supabase
      .from("orders")
      .select("id, status, wompi_reference, service_type")
      .in("id", orderIds);
    if (ordErr) {
      console.error("[mesas] orders:", ordErr.message);
    } else {
      for (const o of orders ?? []) {
        ordersById.set(String(o.id), {
          id: String(o.id),
          status: o.status != null ? String(o.status) : null,
          wompi_reference:
            o.wompi_reference != null ? String(o.wompi_reference) : null,
          service_type:
            o.service_type != null ? String(o.service_type) : null,
        });
      }
    }
  }

  const openByTable = new Map<
    string,
    {
      id: string;
      openedAt: string;
      guestCount: number | null;
      note: string | null;
      orderId: string;
    }
  >();
  const staleSessionIds: string[] = [];

  for (const s of sessions ?? []) {
    const sid = String(s.id);
    const tableId = String(s.dining_table_id);
    const orderId = s.order_id != null ? String(s.order_id) : "";
    const order = orderId ? ordersById.get(orderId) : null;
    if (!isLiveSalonPedido(order)) {
      staleSessionIds.push(sid);
      continue;
    }
    openByTable.set(tableId, {
      id: sid,
      openedAt: String(s.opened_at),
      guestCount: s.guest_count == null ? null : Number(s.guest_count) || null,
      note: s.note != null ? String(s.note) : null,
      orderId,
    });
  }

  if (staleSessionIds.length > 0) {
    const nowIso = new Date().toISOString();
    const { error: closeErr } = await supabase
      .from("dining_table_sessions")
      .update({ status: "closed", closed_at: nowIso })
      .in("id", staleSessionIds)
      .eq("status", "open");
    if (closeErr) {
      console.error("[mesas] close stale:", closeErr.message);
    }
  }

  const all: DiningTableWithSession[] = [];
  const available: DiningTableWithSession[] = [];
  const occupied: DiningTableWithSession[] = [];

  for (const t of tables ?? []) {
    const row: DiningTableWithSession = {
      id: String(t.id),
      name: String(t.name),
      code: String(t.code),
      seats: Number(t.seats) || 0,
      sortOrder: Number(t.sort_order) || 0,
      openSession: openByTable.get(String(t.id)) ?? null,
    };
    all.push(row);
    if (row.openSession) occupied.push(row);
    else available.push(row);
  }

  return { all, available, occupied };
}
