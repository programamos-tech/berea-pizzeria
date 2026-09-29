import {
  createdAtBoundsForReportYmdRange,
  todayYmdInReportStore,
} from "@/lib/admin-report-range";
import { expensePaymentAffectsDailyCashDrawer } from "@/lib/expenses-constants";
import {
  posPaymentBreakdownForOrder,
  type PosPaymentBreakdownRow,
} from "@/lib/pos-payment-breakdown";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCurrentBranchInventoryMap } from "@/lib/branch-inventory";

export type CashSessionStatus = "open" | "closed";

export type CashStockOutLine = {
  product_id: string;
  name: string;
  reference: string | null;
  quantity: number;
  /** Stock local al momento del cierre (congelado en el JSON). */
  stock_remaining: number | null;
};

export type CashExpenseLine = {
  id: string;
  concept: string;
  payment_method: string;
  amount_cents: number;
};

export type CashRegisterSessionRow = {
  id: string;
  business_day: string;
  status: CashSessionStatus;
  opening_float_cents: number;
  opened_at: string;
  opened_by: string;
  sales_count: number | null;
  sales_total_cents: number | null;
  sales_cash_cents: number | null;
  sales_transfer_cents: number | null;
  sales_mixed_cents: number | null;
  sales_other_cents: number | null;
  expenses_cash_cents: number | null;
  expenses_other_cents: number | null;
  expected_cash_cents: number | null;
  counted_cash_cents: number | null;
  cash_difference_cents: number | null;
  units_sold: number | null;
  stock_out_lines: CashStockOutLine[];
  expense_lines: CashExpenseLine[];
  notes: string | null;
  closed_at: string | null;
  closed_by: string | null;
  created_at: string;
};

export type CashDayLiveTotals = {
  businessDay: string;
  salesCount: number;
  salesTotalCents: number;
  salesCashCents: number;
  salesTransferCents: number;
  salesMixedCents: number;
  salesOtherCents: number;
  expensesCashCents: number;
  expensesOtherCents: number;
  unitsSold: number;
  stockOutLines: CashStockOutLine[];
  expenseLines: CashExpenseLine[];
  expectedCashCents: number;
};

/** Resumen del turno para el modal de cierre (conteo a ciegas del billete contado). */
export type CashDayBlindSummary = {
  businessDay: string;
  salesCount: number;
  unitsSold: number;
  openingFloatCents: number;
  salesCashCents: number;
  salesTransferCents: number;
  salesMixedCents: number;
  salesOtherCents: number;
  salesTotalCents: number;
  expensesCashCents: number;
  expensesOtherCents: number;
  expensesTotalCents: number;
  /** Arrastre del día anterior + cobros en efectivo − egresos en efectivo. */
  expectedCashCents: number;
  stockOutLines: CashStockOutLine[];
  expenseLines: Array<{
    id: string;
    concept: string;
    payment_method: string;
    amount_cents: number;
    affects_cash_drawer: boolean;
  }>;
};

export function toBlindCashSummary(
  live: CashDayLiveTotals,
  openingFloatCents: number,
): CashDayBlindSummary {
  const expensesTotalCents = live.expensesCashCents + live.expensesOtherCents;
  return {
    businessDay: live.businessDay,
    salesCount: live.salesCount,
    unitsSold: live.unitsSold,
    openingFloatCents: Math.max(0, Math.floor(openingFloatCents)),
    salesCashCents: live.salesCashCents,
    salesTransferCents: live.salesTransferCents,
    salesMixedCents: live.salesMixedCents,
    salesOtherCents: live.salesOtherCents,
    salesTotalCents: live.salesTotalCents,
    expensesCashCents: live.expensesCashCents,
    expensesOtherCents: live.expensesOtherCents,
    expensesTotalCents,
    expectedCashCents: live.expectedCashCents,
    stockOutLines: live.stockOutLines,
    expenseLines: live.expenseLines.map((e) => ({
      id: e.id,
      concept: e.concept,
      payment_method: e.payment_method,
      amount_cents: e.amount_cents,
      affects_cash_drawer: expensePaymentAffectsDailyCashDrawer(e.payment_method),
    })),
  };
}

/** Solo UI: arma el resumen del modal a partir de un cierre ya guardado. */
export function closedSessionToBlindSummary(
  session: CashRegisterSessionRow,
): CashDayBlindSummary {
  const expensesCashCents = Math.max(
    0,
    Math.floor(Number(session.expenses_cash_cents ?? 0)),
  );
  const expensesOtherCents = Math.max(
    0,
    Math.floor(Number(session.expenses_other_cents ?? 0)),
  );
  return {
    businessDay: session.business_day,
    salesCount: Math.max(0, Math.floor(Number(session.sales_count ?? 0))),
    unitsSold: Math.max(0, Math.floor(Number(session.units_sold ?? 0))),
    openingFloatCents: Math.max(
      0,
      Math.floor(Number(session.opening_float_cents ?? 0)),
    ),
    salesCashCents: Math.max(0, Math.floor(Number(session.sales_cash_cents ?? 0))),
    salesTransferCents: Math.max(
      0,
      Math.floor(Number(session.sales_transfer_cents ?? 0)),
    ),
    salesMixedCents: Math.max(
      0,
      Math.floor(Number(session.sales_mixed_cents ?? 0)),
    ),
    salesOtherCents: Math.max(
      0,
      Math.floor(Number(session.sales_other_cents ?? 0)),
    ),
    salesTotalCents: Math.max(
      0,
      Math.floor(Number(session.sales_total_cents ?? 0)),
    ),
    expensesCashCents,
    expensesOtherCents,
    expensesTotalCents: expensesCashCents + expensesOtherCents,
    expectedCashCents: Math.max(
      0,
      Math.floor(Number(session.expected_cash_cents ?? 0)),
    ),
    stockOutLines: session.stock_out_lines,
    expenseLines: session.expense_lines.map((e) => ({
      id: e.id,
      concept: e.concept,
      payment_method: e.payment_method,
      amount_cents: e.amount_cents,
      affects_cash_drawer: expensePaymentAffectsDailyCashDrawer(e.payment_method),
    })),
  };
}

const SESSION_SELECT =
  "id,business_day,status,opening_float_cents,opened_at,opened_by,sales_count,sales_total_cents,sales_cash_cents,sales_transfer_cents,sales_mixed_cents,sales_other_cents,expenses_cash_cents,expenses_other_cents,expected_cash_cents,counted_cash_cents,cash_difference_cents,units_sold,stock_out_lines,expense_lines,notes,closed_at,closed_by,created_at";

function parseStockLines(raw: unknown): CashStockOutLine[] {
  if (!Array.isArray(raw)) return [];
  const out: CashStockOutLine[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const productId = String(r.product_id ?? "").trim();
    const name = String(r.name ?? "").trim();
    const qty = Math.max(0, Math.floor(Number(r.quantity ?? 0)));
    if (!productId || !name || qty <= 0) continue;
    const reference =
      r.reference == null || String(r.reference).trim() === ""
        ? null
        : String(r.reference).trim();
    const stockRaw = r.stock_remaining;
    const stockParsed =
      stockRaw == null
        ? null
        : Math.max(0, Math.floor(Number(stockRaw)));
    out.push({
      product_id: productId,
      name,
      reference,
      quantity: qty,
      stock_remaining:
        stockParsed != null && Number.isFinite(stockParsed) ? stockParsed : null,
    });
  }
  return out;
}

/** Rellena stock_remaining con stock_local actual si el cierre no lo congeló. */
export async function enrichStockOutLinesRemaining(
  supabase: SupabaseClient,
  lines: CashStockOutLine[],
): Promise<CashStockOutLine[]> {
  const needIds = [
    ...new Set(
      lines
        .filter((l) => l.stock_remaining == null)
        .map((l) => l.product_id)
        .filter(Boolean),
    ),
  ];
  if (needIds.length === 0) return lines;

  const branchInventory = await fetchCurrentBranchInventoryMap(
    supabase,
    needIds,
  );
  const stockById = new Map<string, number>();
  const { data: products } = await supabase
    .from("products")
    .select("id,stock_local")
    .in("id", needIds);
  for (const p of products ?? []) {
    stockById.set(String(p.id), branchInventory.get(String(p.id)) ?? 0);
  }

  return lines.map((l) =>
    l.stock_remaining != null
      ? l
      : {
          ...l,
          stock_remaining: stockById.has(l.product_id)
            ? (stockById.get(l.product_id) as number)
            : null,
        },
  );
}

function parseExpenseLines(raw: unknown): CashExpenseLine[] {
  if (!Array.isArray(raw)) return [];
  const out: CashExpenseLine[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = String(r.id ?? "").trim();
    const concept = String(r.concept ?? "").trim();
    const amount = Math.max(0, Math.floor(Number(r.amount_cents ?? 0)));
    if (!id || !concept || amount <= 0) continue;
    out.push({
      id,
      concept,
      payment_method: String(r.payment_method ?? "").trim() || "otro",
      amount_cents: amount,
    });
  }
  return out;
}

export function mapCashSessionRow(raw: Record<string, unknown>): CashRegisterSessionRow {
  return {
    id: String(raw.id),
    business_day: String(raw.business_day).slice(0, 10),
    status: raw.status === "closed" ? "closed" : "open",
    opening_float_cents: Math.max(0, Math.floor(Number(raw.opening_float_cents ?? 0))),
    opened_at: String(raw.opened_at),
    opened_by: String(raw.opened_by),
    sales_count:
      raw.sales_count == null ? null : Math.max(0, Math.floor(Number(raw.sales_count))),
    sales_total_cents:
      raw.sales_total_cents == null
        ? null
        : Math.max(0, Math.floor(Number(raw.sales_total_cents))),
    sales_cash_cents:
      raw.sales_cash_cents == null
        ? null
        : Math.max(0, Math.floor(Number(raw.sales_cash_cents))),
    sales_transfer_cents:
      raw.sales_transfer_cents == null
        ? null
        : Math.max(0, Math.floor(Number(raw.sales_transfer_cents))),
    sales_mixed_cents:
      raw.sales_mixed_cents == null
        ? null
        : Math.max(0, Math.floor(Number(raw.sales_mixed_cents))),
    sales_other_cents:
      raw.sales_other_cents == null
        ? null
        : Math.max(0, Math.floor(Number(raw.sales_other_cents))),
    expenses_cash_cents:
      raw.expenses_cash_cents == null
        ? null
        : Math.max(0, Math.floor(Number(raw.expenses_cash_cents))),
    expenses_other_cents:
      raw.expenses_other_cents == null
        ? null
        : Math.max(0, Math.floor(Number(raw.expenses_other_cents))),
    expected_cash_cents:
      raw.expected_cash_cents == null
        ? null
        : Math.floor(Number(raw.expected_cash_cents)),
    counted_cash_cents:
      raw.counted_cash_cents == null
        ? null
        : Math.max(0, Math.floor(Number(raw.counted_cash_cents))),
    cash_difference_cents:
      raw.cash_difference_cents == null
        ? null
        : Math.floor(Number(raw.cash_difference_cents)),
    units_sold:
      raw.units_sold == null ? null : Math.max(0, Math.floor(Number(raw.units_sold))),
    stock_out_lines: parseStockLines(raw.stock_out_lines),
    expense_lines: parseExpenseLines(raw.expense_lines),
    notes: raw.notes == null ? null : String(raw.notes),
    closed_at: raw.closed_at == null ? null : String(raw.closed_at),
    closed_by: raw.closed_by == null ? null : String(raw.closed_by),
    created_at: String(raw.created_at),
  };
}

/**
 * Efectivo esperado en gaveta al cierre.
 * Incluye el arrastre del cierre anterior (contado) + cobros − egresos del día.
 * Los $100.000 de cambio físico quedan fuera del sistema y no se suman acá.
 */
export function expectedCashFromParts(
  openingFloatCents: number,
  salesCashCents: number,
  expensesCashCents: number,
): number {
  return (
    Math.max(0, Math.floor(openingFloatCents)) +
    Math.max(0, Math.floor(salesCashCents)) -
    Math.max(0, Math.floor(expensesCashCents))
  );
}

/** Alias histórico: mismo cálculo que expectedCashFromParts. */
export function drawerCashFromParts(
  openingFloatCents: number,
  salesCashCents: number,
  expensesCashCents: number,
): number {
  return expectedCashFromParts(
    openingFloatCents,
    salesCashCents,
    expensesCashCents,
  );
}

/** Totales vivos del día calendario (Bogotá) para armar / cerrar caja. */
export async function fetchCashDayLiveTotals(
  supabase: SupabaseClient,
  businessDayYmd: string,
  openingFloatCents: number,
): Promise<CashDayLiveTotals> {
  const bounds = createdAtBoundsForReportYmdRange(businessDayYmd, businessDayYmd);
  if (!bounds) {
    return {
      businessDay: businessDayYmd,
      salesCount: 0,
      salesTotalCents: 0,
      salesCashCents: 0,
      salesTransferCents: 0,
      salesMixedCents: 0,
      salesOtherCents: 0,
      expensesCashCents: 0,
      expensesOtherCents: 0,
      unitsSold: 0,
      stockOutLines: [],
      expenseLines: [],
      expectedCashCents: expectedCashFromParts(openingFloatCents, 0, 0),
    };
  }

  const [ordersRes, expensesRes, paymentsRes] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id,status,total_cents,wompi_reference,pos_mixed_cash_cents,pos_mixed_transfer_cents,created_at",
      )
      .eq("status", "paid")
      .gte("created_at", bounds.gte)
      .lt("created_at", bounds.lt),
    supabase
      .from("store_expenses")
      .select("id,concept,amount_cents,payment_method,expense_date,is_cancelled,expense_scope")
      .eq("expense_date", businessDayYmd)
      .eq("expense_scope", "diario")
      .eq("is_cancelled", false)
      .order("created_at", { ascending: true }),
    supabase
      .from("order_payments")
      .select("amount_cents,payment_method")
      .eq("is_cancelled", false)
      .gte("paid_at", bounds.gte)
      .lt("paid_at", bounds.lt),
  ]);

  if (ordersRes.error) {
    console.error("fetchCashDayLiveTotals orders", ordersRes.error);
  }
  if (expensesRes.error) {
    console.error("fetchCashDayLiveTotals expenses", expensesRes.error);
  }
  if (paymentsRes.error) {
    console.error("fetchCashDayLiveTotals payments", paymentsRes.error);
  }

  const orders = (ordersRes.data ?? []) as Array<
    PosPaymentBreakdownRow & { id?: string }
  >;
  let salesCash = 0;
  let salesTransfer = 0;
  let salesMixed = 0;
  let salesOther = 0;
  let salesTotal = 0;
  const orderIds: string[] = [];
  for (const row of orders) {
    const b = posPaymentBreakdownForOrder(row);
    salesCash += b.cashCents;
    salesTransfer += b.transferCents;
    salesMixed += b.mixedCents;
    salesOther += b.otherCents;
    salesTotal +=
      b.cashCents + b.transferCents + b.mixedCents + b.otherCents;
    if (row.id) orderIds.push(String(row.id));
  }

  for (const pay of paymentsRes.data ?? []) {
    const amount = Math.max(0, Math.floor(Number(pay.amount_cents ?? 0)));
    if (amount <= 0) continue;
    const method = String(pay.payment_method ?? "").trim().toLowerCase();
    if (method === "cash" || method === "efectivo") salesCash += amount;
    else if (
      method === "transfer" ||
      method === "transferencia" ||
      method === "dataphone" ||
      method === "datáfono"
    ) {
      // Transferencia / datáfono → no gaveta; suma a Transferencia / En cuentas.
      salesTransfer += amount;
    } else continue;
    salesTotal += amount;
  }

  let expensesCash = 0;
  let expensesOther = 0;
  const expenseLines: CashExpenseLine[] = [];
  for (const e of expensesRes.data ?? []) {
    const amount = Math.max(0, Math.floor(Number(e.amount_cents ?? 0)));
    if (amount <= 0) continue;
    const pm = String(e.payment_method ?? "").trim().toLowerCase() || "otro";
    if (expensePaymentAffectsDailyCashDrawer(pm)) expensesCash += amount;
    else expensesOther += amount;
    expenseLines.push({
      id: String(e.id),
      concept: String(e.concept ?? "Egreso").trim() || "Egreso",
      payment_method: pm,
      amount_cents: amount,
    });
  }

  let unitsSold = 0;
  const qtyByProduct = new Map<string, number>();
  if (orderIds.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select("product_id,quantity,product_name_snapshot")
      .in("order_id", orderIds);

    for (const item of items ?? []) {
      const qty = Math.max(0, Math.floor(Number(item.quantity ?? 0)));
      if (qty <= 0) continue;
      unitsSold += qty;
      const pid = item.product_id != null ? String(item.product_id) : "";
      if (!pid) continue;
      qtyByProduct.set(pid, (qtyByProduct.get(pid) ?? 0) + qty);
    }
  }

  const productIds = [...qtyByProduct.keys()];
  const nameById = new Map<
    string,
    { name: string; reference: string | null; stock_remaining: number | null }
  >();
  if (productIds.length > 0) {
    const branchInventory = await fetchCurrentBranchInventoryMap(
      supabase,
      productIds,
    );
    const { data: products } = await supabase
      .from("products")
      .select("id,name,reference,stock_local")
      .in("id", productIds);
    for (const p of products ?? []) {
      nameById.set(String(p.id), {
        name: String(p.name ?? "Producto"),
        reference:
          p.reference == null || String(p.reference).trim() === ""
            ? null
            : String(p.reference).trim(),
        stock_remaining: branchInventory.get(String(p.id)) ?? 0,
      });
    }
  }

  // Fallback names from order_items snapshots if product missing
  if (orderIds.length > 0 && productIds.some((id) => !nameById.has(id))) {
    const { data: snaps } = await supabase
      .from("order_items")
      .select("product_id,product_name_snapshot")
      .in("order_id", orderIds)
      .in("product_id", productIds);
    for (const s of snaps ?? []) {
      const pid = String(s.product_id ?? "");
      if (!pid || nameById.has(pid)) continue;
      const n = String(s.product_name_snapshot ?? "").trim();
      if (n) {
        nameById.set(pid, {
          name: n,
          reference: null,
          stock_remaining: null,
        });
      }
    }
  }

  const stockOutLines = [...qtyByProduct.entries()]
    .map(([product_id, quantity]) => {
      const meta = nameById.get(product_id);
      return {
        product_id,
        name: meta?.name ?? "Producto",
        reference: meta?.reference ?? null,
        quantity,
        stock_remaining: meta?.stock_remaining ?? null,
      };
    })
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name))
    .slice(0, 40);

  return {
    businessDay: businessDayYmd,
    salesCount: orders.length,
    salesTotalCents: salesTotal,
    salesCashCents: salesCash,
    salesTransferCents: salesTransfer,
    salesMixedCents: salesMixed,
    salesOtherCents: salesOther,
    expensesCashCents: expensesCash,
    expensesOtherCents: expensesOther,
    unitsSold,
    stockOutLines,
    expenseLines,
    expectedCashCents: expectedCashFromParts(
      openingFloatCents,
      salesCash,
      expensesCash,
    ),
  };
}

/** Contado del último cierre: arrastre sugerido al abrir la caja del día. */
export async function fetchSuggestedOpeningFloatCents(
  supabase: SupabaseClient,
): Promise<number> {
  const { data, error } = await supabase
    .from("cash_register_sessions")
    .select("counted_cash_cents,business_day")
    .eq("status", "closed")
    .order("business_day", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("fetchSuggestedOpeningFloatCents", error);
    return 0;
  }
  return Math.max(0, Math.floor(Number(data?.counted_cash_cents ?? 0)));
}

/**
 * Arrastre de efectivo al inicio de un rango de reportes:
 * fondo de apertura de la caja de `rangeFrom`, o contado del último cierre anterior.
 */
export async function fetchCashArrastreCentsForReportStart(
  supabase: SupabaseClient,
  rangeFromYmd: string,
): Promise<number> {
  const day = rangeFromYmd.slice(0, 10);
  if (!day) return 0;

  const onDay = await fetchCashSessionForBusinessDay(supabase, day);
  if (onDay) {
    return Math.max(0, Math.floor(Number(onDay.opening_float_cents ?? 0)));
  }

  const { data, error } = await supabase
    .from("cash_register_sessions")
    .select("counted_cash_cents,business_day")
    .eq("status", "closed")
    .lt("business_day", day)
    .order("business_day", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("fetchCashArrastreCentsForReportStart", error);
    return 0;
  }
  return Math.max(0, Math.floor(Number(data?.counted_cash_cents ?? 0)));
}

export async function fetchCashSessionForBusinessDay(
  supabase: SupabaseClient,
  businessDayYmd: string,
): Promise<CashRegisterSessionRow | null> {
  const day = businessDayYmd.slice(0, 10);
  const { data, error } = await supabase
    .from("cash_register_sessions")
    .select(SESSION_SELECT)
    .eq("business_day", day)
    .maybeSingle();
  if (error) {
    console.error("fetchCashSessionForBusinessDay", error);
    return null;
  }
  if (!data) return null;
  return mapCashSessionRow(data as Record<string, unknown>);
}

export async function fetchOpenCashSession(
  supabase: SupabaseClient,
): Promise<CashRegisterSessionRow | null> {
  const { data, error } = await supabase
    .from("cash_register_sessions")
    .select(SESSION_SELECT)
    .eq("status", "open")
    .maybeSingle();
  if (error) {
    console.error("fetchOpenCashSession", error);
    return null;
  }
  if (!data) return null;
  return mapCashSessionRow(data as Record<string, unknown>);
}

export async function fetchCashSessionById(
  supabase: SupabaseClient,
  id: string,
): Promise<CashRegisterSessionRow | null> {
  const { data, error } = await supabase
    .from("cash_register_sessions")
    .select(SESSION_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapCashSessionRow(data as Record<string, unknown>);
}

export async function fetchRecentCashSessions(
  supabase: SupabaseClient,
  limit = 30,
): Promise<CashRegisterSessionRow[]> {
  const { rows } = await fetchCashSessionsPage(supabase, {
    page: 1,
    pageSize: limit,
  });
  return rows;
}

export async function fetchCashSessionsPage(
  supabase: SupabaseClient,
  opts: {
    page: number;
    pageSize?: number;
    /** Busca en notas y día (YYYY-MM-DD). */
    q?: string;
    status?: "all" | CashSessionStatus;
    /** Rango inclusivo sobre `business_day` (YYYY-MM-DD). */
    from?: string;
    to?: string;
  },
): Promise<{ rows: CashRegisterSessionRow[]; total: number }> {
  const pageSize = Math.min(50, Math.max(5, Math.trunc(opts.pageSize ?? 15)));
  const page = Math.max(1, Math.trunc(opts.page));
  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;

  let query = supabase
    .from("cash_register_sessions")
    .select(SESSION_SELECT, { count: "estimated" })
    .order("business_day", { ascending: false });

  const status = opts.status ?? "all";
  if (status === "open" || status === "closed") {
    query = query.eq("status", status);
  }

  const fromDay = String(opts.from ?? "").trim();
  const toDay = String(opts.to ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromDay)) {
    query = query.gte("business_day", fromDay);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(toDay)) {
    query = query.lte("business_day", toDay);
  }

  const q = String(opts.q ?? "").trim();
  if (q) {
    const safe = q.replace(/[%_,]/g, "");
    if (safe) {
      query = query.or(`notes.ilike.%${safe}%,business_day.ilike.%${safe}%`);
    }
  }

  const { data, error, count } = await query.range(fromIdx, toIdx);

  if (error) {
    console.error("fetchCashSessionsPage", error);
    return { rows: [], total: 0 };
  }

  return {
    rows: (data ?? []).map((r) => mapCashSessionRow(r as Record<string, unknown>)),
    total: count ?? 0,
  };
}

export function todayBusinessDayYmd(): string {
  return todayYmdInReportStore();
}
