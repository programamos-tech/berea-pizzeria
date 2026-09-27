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
  } | null;
};

export type DiningTablesBoard = {
  available: DiningTableWithSession[];
  occupied: DiningTableWithSession[];
};

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
    return { available: [], occupied: [] };
  }

  const ids = (tables ?? []).map((t) => String(t.id));
  if (ids.length === 0) return { available: [], occupied: [] };

  const { data: sessions, error: sessErr } = await supabase
    .from("dining_table_sessions")
    .select("id, dining_table_id, opened_at, guest_count, note")
    .eq("status", "open")
    .in("dining_table_id", ids);

  if (sessErr) {
    console.error("[mesas] sessions:", sessErr.message);
  }

  const openByTable = new Map<
    string,
    {
      id: string;
      openedAt: string;
      guestCount: number | null;
      note: string | null;
    }
  >();
  for (const s of sessions ?? []) {
    openByTable.set(String(s.dining_table_id), {
      id: String(s.id),
      openedAt: String(s.opened_at),
      guestCount:
        s.guest_count == null ? null : Number(s.guest_count) || null,
      note: s.note != null ? String(s.note) : null,
    });
  }

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
    if (row.openSession) occupied.push(row);
    else available.push(row);
  }

  return { available, occupied };
}
