import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportExpenseDetailLine } from "@/components/admin/ReportLiquidityMetricCards";
import type { StockInvestmentTrend } from "@/lib/admin-stock-investment-trend";
import {
  dayInRange,
  dayKeysInclusiveReport,
  prettyReportDayShortLabel,
  reportCalendarDayKeyFromIso,
  REPORT_LINE_DETAIL_MAX_DAYS,
  reportRangeDayCountInclusive,
} from "@/lib/admin-report-range";
import {
  fetchOrderItemsInChunks,
  fetchOrderPaymentsInReportYmdWindow,
  fetchOrdersCreatedInReportYmdWindow,
} from "@/lib/admin-fetch-orders-for-report";
import { formatCop } from "@/lib/money";
import { isPosDeferredIncome, posPaymentBreakdownForOrder } from "@/lib/pos-payment-breakdown";
import type { TicketTrendPoint } from "@/lib/customer-ticket-trend";
import {
  revenueNetGrossFromLines,
  sumGrossProfitNetOnLinesForPaidOrders,
  sumRevenueNetGrossForOrders,
  type OrderItemRow,
  type OrderRowRef,
  type ProductVatRow,
} from "@/lib/order-revenue-vat";

export type ReportSalesTrendComparison = {
  currentFrom: string;
  currentTo: string;
  priorFrom: string;
  priorTo: string;
  currentTotalCents: number;
  priorTotalCents: number;
  /** null si la semana anterior no tuvo ventas. */
  changePercent: number | null;
  priorDailyAvgCents: number;
};

export type AdminReportDashboardData = {
  periodLabel: string;
  rangeFrom: string;
  rangeTo: string;
  chartFrom: string;
  chartTo: string;
  salesTrendCurrentFrom: string;
  salesTrendCurrentTo: string;
  salesTrendComparison: ReportSalesTrendComparison;
  stockInversionNet: number;
  stockInversionGross: number;
  stockHasProducts: boolean;
  stockHasGrossCost: boolean;
  stockInvestmentTrend: StockInvestmentTrend | null;
  ingresosSinIvaPeriod: number;
  ingresosConIvaPeriod: number;
  ivaRecaudadoPeriod: number;
  gananciaBruta: number;
  gananciaNeta: number;
  totalCobradoPedidos: number;
  efectivo: number;
  transferencia: number;
  anuladas: number;
  ventasVirtuales: number;
  ventasPagadasPeriod: number;
  egresosPeriod: number;
  egresosEfectivoCents: number;
  egresosTransferenciaBucketCents: number;
  cantidadEgresosPeriod: number;
  efectivoNetoCaja: number;
  transferenciaNeta: number;
  reportExpensesEfectivoLines: ReportExpenseDetailLine[];
  reportExpensesOtrosLines: ReportExpenseDetailLine[];
  reportIncomeChartPoints: TicketTrendPoint[];
  peakIncomeDayKey: string | null;
  peakIncomeDayCents: number;
  ordersRangeError: string | null;
  revenueApproxFromOrderTotals: boolean;
};

type ReportFetchOpts = {
  rangeFrom: string;
  rangeTo: string;
  chartFrom: string;
  chartTo: string;
  salesTrendCurrentFrom: string;
  salesTrendCurrentTo: string;
  salesTrendPriorFrom: string;
  salesTrendPriorTo: string;
  fetchFrom: string;
  fetchTo: string;
  periodLabel: string;
  /** Vista "por periodo": no muestra stock; evita RPC + trend de 7 días. */
  skipStock?: boolean;
};

function revenueNetGrossFromOrderTotals(orders: OrderRowRef[]): {
  net: number;
  gross: number;
} {
  let gross = 0;
  for (const o of orders) {
    if (o.status !== "paid") continue;
    gross += Math.max(0, Math.round(Number(o.total_cents ?? 0)));
  }
  return { net: gross, gross };
}

function parseRpcDashboardPayload(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
    return null;
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

function normalizePaidOrderIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      const id = entry.trim();
      if (id) out.push(id);
    }
  }
  return out;
}

async function fetchStockInvestmentTotals(supabase: SupabaseClient): Promise<{
  netCents: number;
  grossCents: number;
  productCount: number;
}> {
  const { data, error } = await supabase.rpc("admin_stock_investment_totals");
  if (!error && data?.length) {
    const row = data[0] as { net_cents?: number; gross_cents?: number };
    const netCents = Number(row.net_cents ?? 0);
    const grossCents = Number(row.gross_cents ?? 0);
    // No hacemos COUNT de products: solo sirve para “hay stock”, y el round-trip extra
    // ralentiza los KPIs de tienda.
    return {
      netCents,
      grossCents,
      productCount: netCents > 0 || grossCents > 0 ? 1 : 0,
    };
  }

  const { data: products } = await supabase
    .from("products")
    .select("stock_quantity,cost_cents");
  const rows = products ?? [];
  let netCents = 0;
  for (const p of rows) {
    const stock = Number((p as { stock_quantity?: number }).stock_quantity ?? 0);
    const cost = Number((p as { cost_cents?: number }).cost_cents ?? 0);
    netCents += cost * stock;
  }
  return { netCents, grossCents: netCents, productCount: rows.length };
}

async function fetchReportExpenses(
  supabase: SupabaseClient,
  fetchFrom: string,
  fetchTo: string,
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  const withKind = await supabase
    .from("store_expenses")
    .select(
      "id,concept,category,amount_cents,payment_method,notes,expense_date,created_at,is_cancelled,expense_kind",
    )
    .gte("expense_date", fetchFrom)
    .lte("expense_date", fetchTo)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1500);

  if (!withKind.error) {
    return { rows: (withKind.data ?? []) as Record<string, unknown>[], error: null };
  }

  const withCancelled = await supabase
    .from("store_expenses")
    .select(
      "id,concept,category,amount_cents,payment_method,notes,expense_date,created_at,is_cancelled",
    )
    .gte("expense_date", fetchFrom)
    .lte("expense_date", fetchTo)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1500);

  if (!withCancelled.error) {
    return { rows: (withCancelled.data ?? []) as Record<string, unknown>[], error: null };
  }

  const fallback = await supabase
    .from("store_expenses")
    .select(
      "id,concept,category,amount_cents,payment_method,notes,expense_date,created_at",
    )
    .gte("expense_date", fetchFrom)
    .lte("expense_date", fetchTo)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1500);

  return {
    rows: (fallback.data ?? []) as Record<string, unknown>[],
    error: fallback.error?.message ?? withCancelled.error.message,
  };
}

function parseRpcExpenseLines(raw: unknown): ReportExpenseDetailLine[] {
  if (!Array.isArray(raw)) return [];
  const out: ReportExpenseDetailLine[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    out.push({
      id: String(r.id ?? ""),
      concept: String(r.concept ?? ""),
      amount_cents: Number(r.amount_cents ?? 0),
      expense_date: String(r.expense_date ?? ""),
      payment_method: String(r.payment_method ?? ""),
      category: r.category != null ? String(r.category) : null,
      created_at: typeof r.created_at === "string" ? r.created_at : null,
    });
  }
  return out;
}

function splitExpenseLines(lines: ReportExpenseDetailLine[]): {
  efectivo: ReportExpenseDetailLine[];
  otros: ReportExpenseDetailLine[];
} {
  const efectivo: ReportExpenseDetailLine[] = [];
  const otros: ReportExpenseDetailLine[] = [];
  for (const line of lines) {
    if (line.payment_method.trim().toLowerCase() === "efectivo") {
      efectivo.push(line);
    } else {
      otros.push(line);
    }
  }
  return { efectivo, otros };
}

async function fetchPaidOrdersForRevenue(
  supabase: SupabaseClient,
  paidOrderIds: string[],
): Promise<OrderRowRef[]> {
  if (paidOrderIds.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < paidOrderIds.length; i += 120) {
    chunks.push(paidOrderIds.slice(i, i + 120));
  }
  const parts = await Promise.all(
    chunks.map(async (part) => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,status,total_cents,created_at,wompi_reference")
        .in("id", part);
      if (error) {
        console.error("[admin reportes] orders by id:", error.message);
        return [] as OrderRowRef[];
      }
      return (data ?? []) as OrderRowRef[];
    }),
  );
  return parts.flat();
}

/** Ingresos + ganancia bruta del periodo en 1 RPC (fallback: ítems vía PostgREST). */
async function fetchPeriodLineMetricsRpc(
  supabase: SupabaseClient,
  rangeFrom: string,
  rangeTo: string,
): Promise<{
  ingresosSinIva: number;
  ingresosConIva: number;
  gananciaBruta: number;
} | null> {
  const { data, error } = await supabase.rpc("admin_report_period_line_metrics", {
    p_from: rangeFrom,
    p_to: rangeTo,
  });
  if (error) {
    console.warn(
      "[admin reportes] period_line_metrics RPC:",
      error.message,
      "→ fallback PostgREST",
    );
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  return {
    ingresosSinIva: Math.round(Number(row.ingresos_sin_iva ?? 0)),
    ingresosConIva: Math.round(Number(row.ingresos_con_iva ?? 0)),
    gananciaBruta: Math.round(Number(row.ganancia_bruta ?? 0)),
  };
}

async function fetchPeriodLineMetricsFallback(
  supabase: SupabaseClient,
  paidOrderIds: string[],
): Promise<{
  ingresosSinIva: number;
  ingresosConIva: number;
  gananciaBruta: number;
}> {
  if (paidOrderIds.length === 0) {
    return { ingresosSinIva: 0, ingresosConIva: 0, gananciaBruta: 0 };
  }
  const paidPeriodOrders = await fetchPaidOrdersForRevenue(supabase, paidOrderIds);
  const { orderItems, productsById } = await fetchLineDetailForOrders(
    supabase,
    paidPeriodOrders,
  );
  const rev = sumRevenueNetGrossForOrders(
    paidPeriodOrders,
    orderItems,
    productsById,
  );
  return {
    ingresosSinIva: rev.net,
    ingresosConIva: rev.gross,
    gananciaBruta: sumGrossProfitNetOnLinesForPaidOrders(
      paidPeriodOrders,
      orderItems,
      productsById,
    ),
  };
}

async function fetchLineDetailForOrders(
  supabase: SupabaseClient,
  paidPeriodOrders: OrderRowRef[],
): Promise<{
  orderItems: OrderItemRow[];
  productsById: Map<string, ProductVatRow>;
}> {
  const paidOrderIds = paidPeriodOrders.map((o) => o.id).filter(Boolean);
  if (paidOrderIds.length === 0) {
    return { orderItems: [], productsById: new Map() };
  }

  const { rows: itemRows, error: itemsErr } = await fetchOrderItemsInChunks(
    supabase,
    paidOrderIds,
    "order_id,product_id,quantity,unit_price_cents",
  );
  if (itemsErr) console.error("[admin reportes] order_items:", itemsErr);
  const orderItems = itemRows as OrderItemRow[];

  const productsById = new Map<string, ProductVatRow>();
  const pids = [
    ...new Set(
      orderItems.map((i) => i.product_id).filter((id): id is string => Boolean(id)),
    ),
  ];
  const prodChunks: string[][] = [];
  for (let i = 0; i < pids.length; i += 120) {
    prodChunks.push(pids.slice(i, i + 120));
  }
  const prodParts = await Promise.all(
    prodChunks.map(async (part) => {
      const { data: prodData } = await supabase
        .from("products")
        .select("id,price_cents,has_vat,vat_percent,cost_cents")
        .in("id", part);
      return (prodData ?? []) as ProductVatRow[];
    }),
  );
  for (const p of prodParts.flat()) {
    productsById.set(p.id as string, p);
  }

  return { orderItems, productsById };
}

function sumIncomeInRange(
  incomeByDay: Map<string, { income: number; count: number }>,
  from: string,
  to: string,
): number {
  let total = 0;
  for (const key of dayKeysInclusiveReport(from, to)) {
    total += incomeByDay.get(key)?.income ?? 0;
  }
  return total;
}

function buildSalesTrendFromIncomeMap(
  incomeByDay: Map<string, { income: number; count: number }>,
  currentFrom: string,
  currentTo: string,
  priorFrom: string,
  priorTo: string,
): {
  points: TicketTrendPoint[];
  comparison: ReportSalesTrendComparison;
  peakIncomeDayKey: string | null;
  peakIncomeDayCents: number;
} {
  const priorTotalCents = sumIncomeInRange(incomeByDay, priorFrom, priorTo);
  const currentTotalCents = sumIncomeInRange(incomeByDay, currentFrom, currentTo);
  const priorDays = dayKeysInclusiveReport(priorFrom, priorTo).length;
  const priorDailyAvgCents =
    priorDays > 0 ? Math.round(priorTotalCents / priorDays) : 0;

  let changePercent: number | null = null;
  if (priorTotalCents > 0) {
    changePercent =
      Math.round(((currentTotalCents - priorTotalCents) / priorTotalCents) * 1000) / 10;
  } else if (currentTotalCents > 0) {
    changePercent = null;
  } else {
    changePercent = 0;
  }

  let peakIncomeDayKey: string | null = null;
  let peakIncomeDayCents = 0;
  const currentKeys = dayKeysInclusiveReport(currentFrom, currentTo);
  const priorKeys = dayKeysInclusiveReport(priorFrom, priorTo);
  const points: TicketTrendPoint[] = currentKeys.map((key, idx) => {
    const income = incomeByDay.get(key);
    const value = income?.income ?? 0;
    const n = income?.count ?? 0;
    const priorKey = priorKeys[idx] ?? "";
    const priorValue = priorKey ? (incomeByDay.get(priorKey)?.income ?? 0) : 0;
    if (value > peakIncomeDayCents) {
      peakIncomeDayKey = key;
      peakIncomeDayCents = value;
    }
    const label = prettyReportDayShortLabel(key);
    const priorLabel = priorKey ? prettyReportDayShortLabel(priorKey) : "";
    return {
      monthKey: key,
      labelX: label,
      dayKey: key,
      detail: `${label}: ${formatCop(value)} esta semana · ${priorLabel ? `${formatCop(priorValue)} sem. ant. (${priorLabel})` : "— sem. ant."} · ${n} venta${n === 1 ? "" : "s"}`,
      avgCents: value,
      orderCount: n,
      priorWeekCents: priorValue,
      priorWeekDayKey: priorKey || undefined,
    };
  });

  return {
    points,
    comparison: {
      currentFrom,
      currentTo,
      priorFrom,
      priorTo,
      currentTotalCents,
      priorTotalCents,
      changePercent,
      priorDailyAvgCents,
    },
    peakIncomeDayKey,
    peakIncomeDayCents,
  };
}

function parseIncomeByDayFromRpc(chartPointsRaw: unknown): Map<string, { income: number; count: number }> {
  const incomeByDay = new Map<string, { income: number; count: number }>();
  if (Array.isArray(chartPointsRaw)) {
    for (const row of chartPointsRaw) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const dayKey = String(r.day_key ?? "");
      if (!dayKey) continue;
      incomeByDay.set(dayKey, {
        income: Number(r.income_cents ?? 0),
        count: Number(r.order_count ?? 0),
      });
    }
  }
  return incomeByDay;
}

function buildChartPointsFromRpc(
  currentFrom: string,
  currentTo: string,
  priorFrom: string,
  priorTo: string,
  chartPointsRaw: unknown,
): {
  points: TicketTrendPoint[];
  comparison: ReportSalesTrendComparison;
  peakIncomeDayKey: string | null;
  peakIncomeDayCents: number;
} {
  const incomeByDay = parseIncomeByDayFromRpc(chartPointsRaw);
  return buildSalesTrendFromIncomeMap(
    incomeByDay,
    currentFrom,
    currentTo,
    priorFrom,
    priorTo,
  );
}

function buildEmptyReport(
  opts: ReportFetchOpts,
  message: string | null,
): AdminReportDashboardData {
  const {
    rangeFrom,
    rangeTo,
    chartFrom,
    chartTo,
    salesTrendCurrentFrom,
    salesTrendCurrentTo,
    salesTrendPriorFrom,
    salesTrendPriorTo,
    periodLabel,
  } = opts;
  const { points, comparison, peakIncomeDayKey, peakIncomeDayCents } =
    buildChartPointsFromRpc(
      salesTrendCurrentFrom,
      salesTrendCurrentTo,
      salesTrendPriorFrom,
      salesTrendPriorTo,
      [],
    );
  return {
    periodLabel,
    rangeFrom,
    rangeTo,
    chartFrom,
    chartTo,
    salesTrendCurrentFrom,
    salesTrendCurrentTo,
    salesTrendComparison: comparison,
    stockInversionNet: 0,
    stockInversionGross: 0,
    stockHasProducts: false,
    stockHasGrossCost: false,
    stockInvestmentTrend: null,
    ingresosSinIvaPeriod: 0,
    ingresosConIvaPeriod: 0,
    ivaRecaudadoPeriod: 0,
    gananciaBruta: 0,
    gananciaNeta: 0,
    totalCobradoPedidos: 0,
    efectivo: 0,
    transferencia: 0,
    anuladas: 0,
    ventasVirtuales: 0,
    ventasPagadasPeriod: 0,
    egresosPeriod: 0,
    egresosEfectivoCents: 0,
    egresosTransferenciaBucketCents: 0,
    cantidadEgresosPeriod: 0,
    efectivoNetoCaja: 0,
    transferenciaNeta: 0,
    reportExpensesEfectivoLines: [],
    reportExpensesOtrosLines: [],
    reportIncomeChartPoints: points,
    peakIncomeDayKey,
    peakIncomeDayCents,
    ordersRangeError: message,
    revenueApproxFromOrderTotals: false,
  };
}

async function fetchAdminReportViaRpc(
  supabase: SupabaseClient,
  opts: ReportFetchOpts,
): Promise<AdminReportDashboardData | null> {
  const {
    rangeFrom,
    rangeTo,
    chartFrom,
    chartTo,
    fetchFrom,
    fetchTo,
    periodLabel,
    skipStock = false,
  } = opts;

  const emptyStock = {
    netCents: 0,
    grossCents: 0,
    productCount: 0,
  };

  const periodDayCount = reportRangeDayCountInclusive(rangeFrom, rangeTo);
  const needsLineDetailForPeriod = periodDayCount <= REPORT_LINE_DETAIL_MAX_DAYS;
  const revenueApproxFromOrderTotals = !needsLineDetailForPeriod;

  // Dashboard (con ingresos/ganancia embebidos) + stock en paralelo.
  // El trend de stock (activity log) ya no bloquea los KPIs.
  const [stockTotals, rpcRes] = await Promise.all([
    skipStock ? Promise.resolve(emptyStock) : fetchStockInvestmentTotals(supabase),
    supabase.rpc("admin_report_dashboard_agg", {
      p_fetch_from: fetchFrom,
      p_fetch_to: fetchTo,
      p_range_from: rangeFrom,
      p_range_to: rangeTo,
      p_chart_from: chartFrom,
      p_chart_to: chartTo,
    }),
  ]);

  if (rpcRes.error) {
    console.error("[admin reportes] admin_report_dashboard_agg:", rpcRes.error.message);
    return null;
  }

  const d = parseRpcDashboardPayload(rpcRes.data);
  if (!d) {
    console.error("[admin reportes] admin_report_dashboard_agg: payload inválido");
    return null;
  }

  let ingresosSinIvaPeriod = 0;
  let ingresosConIvaPeriod = 0;
  let gananciaBruta = 0;

  const embeddedSin = d.ingresosSinIva ?? d.ingresos_sin_iva;
  const embeddedCon = d.ingresosConIva ?? d.ingresos_con_iva;
  const embeddedBruta = d.gananciaBruta ?? d.ganancia_bruta;
  const hasEmbeddedLineMetrics =
    embeddedSin != null || embeddedCon != null || embeddedBruta != null;

  if (needsLineDetailForPeriod && hasEmbeddedLineMetrics) {
    ingresosSinIvaPeriod = Math.round(Number(embeddedSin ?? 0));
    ingresosConIvaPeriod = Math.round(Number(embeddedCon ?? 0));
    gananciaBruta = Math.round(Number(embeddedBruta ?? 0));
  } else if (needsLineDetailForPeriod) {
    const lineRpc = await fetchPeriodLineMetricsRpc(supabase, rangeFrom, rangeTo);
    if (lineRpc) {
      ingresosSinIvaPeriod = lineRpc.ingresosSinIva;
      ingresosConIvaPeriod = lineRpc.ingresosConIva;
      gananciaBruta = lineRpc.gananciaBruta;
    } else {
      const paidOrderIds = normalizePaidOrderIds(d.paidOrderIds);
      const fb = await fetchPeriodLineMetricsFallback(supabase, paidOrderIds);
      ingresosSinIvaPeriod = fb.ingresosSinIva;
      ingresosConIvaPeriod = fb.ingresosConIva;
      gananciaBruta = fb.gananciaBruta;
    }
  } else {
    const totalCobrado = Math.round(Number(d.totalCobradoPedidos ?? 0));
    ingresosSinIvaPeriod = totalCobrado;
    ingresosConIvaPeriod = totalCobrado;
    gananciaBruta = 0;
  }

  const ivaRecaudadoPeriod = Math.max(
    0,
    ingresosConIvaPeriod - ingresosSinIvaPeriod,
  );

  const expenseLines = parseRpcExpenseLines(d.expenseLines);
  const { efectivo: reportExpensesEfectivoLines, otros: reportExpensesOtrosLines } =
    splitExpenseLines(expenseLines);

  const egresosPeriod = Number(d.egresosPeriod ?? 0);
  const egresosEfectivoCents = Number(d.egresosEfectivoCents ?? 0);
  const egresosTransferenciaBucketCents = Number(
    d.egresosTransferenciaBucketCents ?? 0,
  );
  const gananciaNeta = gananciaBruta - egresosPeriod;
  const efectivo = Number(d.efectivo ?? 0);
  const transferencia = Number(d.transferencia ?? 0);
  const efectivoNetoCaja = efectivo - egresosEfectivoCents;
  const transferenciaNeta = transferencia - egresosTransferenciaBucketCents;

  const { points, comparison, peakIncomeDayKey, peakIncomeDayCents } =
    buildChartPointsFromRpc(
      opts.salesTrendCurrentFrom,
      opts.salesTrendCurrentTo,
      opts.salesTrendPriorFrom,
      opts.salesTrendPriorTo,
      d.chartPoints,
    );

  return {
    periodLabel,
    rangeFrom,
    rangeTo,
    chartFrom,
    chartTo,
    salesTrendCurrentFrom: opts.salesTrendCurrentFrom,
    salesTrendCurrentTo: opts.salesTrendCurrentTo,
    salesTrendComparison: comparison,
    stockInversionNet: stockTotals.netCents,
    stockInversionGross: stockTotals.grossCents,
    stockHasProducts: stockTotals.productCount > 0,
    stockHasGrossCost: stockTotals.grossCents > 0,
    // El % vs 7 días exigía escanear activity_log + catálogo entero; la UI ya
    // muestra c/IVA cuando no hay trend.
    stockInvestmentTrend: null,
    ingresosSinIvaPeriod,
    ingresosConIvaPeriod,
    ivaRecaudadoPeriod,
    gananciaBruta,
    gananciaNeta,
    totalCobradoPedidos: Number(d.totalCobradoPedidos ?? 0),
    efectivo,
    transferencia,
    anuladas: Number(d.anuladas ?? 0),
    ventasVirtuales: Number(d.ventasVirtuales ?? 0),
    ventasPagadasPeriod: Number(d.ventasPagadasPeriod ?? 0),
    egresosPeriod,
    egresosEfectivoCents,
    egresosTransferenciaBucketCents,
    cantidadEgresosPeriod: Number(d.cantidadEgresosPeriod ?? 0),
    efectivoNetoCaja,
    transferenciaNeta,
    reportExpensesEfectivoLines,
    reportExpensesOtrosLines,
    reportIncomeChartPoints: points,
    peakIncomeDayKey,
    peakIncomeDayCents,
    ordersRangeError: null,
    revenueApproxFromOrderTotals,
  };
}

async function fetchAdminReportViaLegacy(
  supabase: SupabaseClient,
  opts: ReportFetchOpts,
): Promise<AdminReportDashboardData | null> {
  const {
    rangeFrom,
    rangeTo,
    chartFrom,
    chartTo,
    fetchFrom,
    fetchTo,
    periodLabel,
    skipStock = false,
  } = opts;

  const emptyStock = {
    netCents: 0,
    grossCents: 0,
    productCount: 0,
  };

  const [stockTotals, expensesRes, ordersResult, paymentsResult] = await Promise.all([
    skipStock ? Promise.resolve(emptyStock) : fetchStockInvestmentTotals(supabase),
    fetchReportExpenses(supabase, fetchFrom, fetchTo),
    fetchOrdersCreatedInReportYmdWindow(
      supabase,
      fetchFrom,
      fetchTo,
      "id,status,total_cents,created_at,wompi_reference,pos_mixed_cash_cents,pos_mixed_transfer_cents",
    ),
    fetchOrderPaymentsInReportYmdWindow(supabase, fetchFrom, fetchTo),
  ]);

  const expenses = expensesRes.rows;
  const orders = (ordersResult.rows ?? []) as OrderRowRef[];

  let totalCobradoPedidos = 0;
  let efectivo = 0;
  let transferencia = 0;
  let anuladas = 0;
  let ventasVirtuales = 0;
  let ventasPagadasPeriod = 0;
  let egresosPeriod = 0;
  let egresosEfectivoCents = 0;
  let egresosTransferenciaBucketCents = 0;
  let cantidadEgresosPeriod = 0;
  const reportExpensesEfectivoLines: ReportExpenseDetailLine[] = [];
  const reportExpensesOtrosLines: ReportExpenseDetailLine[] = [];

  for (const o of orders) {
    const createdAt = typeof o.created_at === "string" ? o.created_at : null;
    const dk = createdAt ? reportCalendarDayKeyFromIso(createdAt) : "";
    if (!createdAt || !dayInRange(dk, rangeFrom, rangeTo)) continue;
    const total = Number(o.total_cents ?? 0);
    if (o.status === "paid") {
      ventasPagadasPeriod += 1;
      const ref = String(o.wompi_reference ?? "");
      if (!isPosDeferredIncome(ref)) {
        totalCobradoPedidos += total;
      }
      if (!ref.startsWith("POS:")) ventasVirtuales += total;
      const pay = posPaymentBreakdownForOrder({
        status: "paid",
        total_cents: total,
        wompi_reference: ref || null,
        pos_mixed_cash_cents: (o as { pos_mixed_cash_cents?: number | null })
          .pos_mixed_cash_cents,
        pos_mixed_transfer_cents: (o as { pos_mixed_transfer_cents?: number | null })
          .pos_mixed_transfer_cents,
      });
      efectivo += pay.cashCents;
      transferencia += pay.transferCents + pay.otherCents;
    } else if (o.status === "cancelled") {
      anuladas += 1;
    }
  }

  for (const pay of paymentsResult.rows ?? []) {
    const dk = pay.paid_at ? reportCalendarDayKeyFromIso(pay.paid_at) : "";
    if (!pay.paid_at || !dayInRange(dk, rangeFrom, rangeTo)) continue;
    const amount = Math.max(0, Math.floor(Number(pay.amount_cents ?? 0)));
    if (amount <= 0) continue;
    totalCobradoPedidos += amount;
    const method = String(pay.payment_method ?? "").trim().toLowerCase();
    if (method === "cash" || method === "efectivo") efectivo += amount;
    else if (
      method === "transfer" ||
      method === "transferencia" ||
      method === "dataphone" ||
      method === "datáfono"
    ) {
      // Transferencia / datáfono → En cuentas (no gaveta).
      transferencia += amount;
    }
  }

  const paidPeriodOrders = orders.filter(
    (o) =>
      o.status === "paid" &&
      typeof o.created_at === "string" &&
      dayInRange(reportCalendarDayKeyFromIso(o.created_at), rangeFrom, rangeTo),
  );

  const paidOrdersForChart = orders.filter(
    (o) =>
      o.status === "paid" &&
      typeof o.created_at === "string" &&
      dayInRange(
        reportCalendarDayKeyFromIso(o.created_at),
        opts.salesTrendPriorFrom,
        opts.salesTrendCurrentTo,
      ),
  );

  const periodDayCount = reportRangeDayCountInclusive(rangeFrom, rangeTo);
  const needsLineDetailForPeriod = periodDayCount <= REPORT_LINE_DETAIL_MAX_DAYS;
  const revenueApproxFromOrderTotals = !needsLineDetailForPeriod;

  const paidOrderIdsForItems = [
    ...new Set(
      [
        ...(needsLineDetailForPeriod ? paidPeriodOrders : []),
        ...paidOrdersForChart,
      ]
        .map((o) => o.id)
        .filter(Boolean),
    ),
  ];

  let orderItems: OrderItemRow[] = [];
  const productsById = new Map<string, ProductVatRow>();

  if (paidOrderIdsForItems.length > 0) {
    const { rows: itemRows, error: itemsErr } = await fetchOrderItemsInChunks(
      supabase,
      paidOrderIdsForItems,
      "order_id,product_id,quantity,unit_price_cents",
    );
    if (itemsErr) console.error("[admin reportes] order_items:", itemsErr);
    orderItems = itemRows as OrderItemRow[];

    const pids = [
      ...new Set(
        orderItems.map((i) => i.product_id).filter((id): id is string => Boolean(id)),
      ),
    ];
    if (pids.length > 0) {
      for (let i = 0; i < pids.length; i += 120) {
        const part = pids.slice(i, i + 120);
        const { data: prodData } = await supabase
          .from("products")
          .select("id,price_cents,has_vat,vat_percent,cost_cents")
          .in("id", part);
        for (const p of prodData ?? []) {
          productsById.set(p.id as string, p as ProductVatRow);
        }
      }
    }
  }

  let ingresosSinIvaPeriod: number;
  let ingresosConIvaPeriod: number;
  let gananciaBruta: number;

  const collectedPeriodOrders = paidPeriodOrders.filter(
    (o) => !isPosDeferredIncome(o.wompi_reference),
  );
  const abonosPeriodCents = (paymentsResult.rows ?? []).reduce((sum, pay) => {
    const dk = pay.paid_at ? reportCalendarDayKeyFromIso(pay.paid_at) : "";
    if (!pay.paid_at || !dayInRange(dk, rangeFrom, rangeTo)) return sum;
    return sum + Math.max(0, Math.floor(Number(pay.amount_cents ?? 0)));
  }, 0);

  if (needsLineDetailForPeriod) {
    const rev = sumRevenueNetGrossForOrders(
      collectedPeriodOrders,
      orderItems,
      productsById,
    );
    ingresosSinIvaPeriod = rev.net + abonosPeriodCents;
    ingresosConIvaPeriod = rev.gross + abonosPeriodCents;
    gananciaBruta = sumGrossProfitNetOnLinesForPaidOrders(
      paidPeriodOrders,
      orderItems,
      productsById,
    );
  } else {
    const rev = revenueNetGrossFromOrderTotals(collectedPeriodOrders);
    ingresosSinIvaPeriod = rev.net + abonosPeriodCents;
    ingresosConIvaPeriod = rev.gross + abonosPeriodCents;
    gananciaBruta = 0;
  }

  const ivaRecaudadoPeriod = Math.max(
    0,
    ingresosConIvaPeriod - ingresosSinIvaPeriod,
  );

  for (const e of expenses) {
    if ((e as { is_cancelled?: boolean }).is_cancelled === true) continue;
    // Solo gastos operativos; no sumar egresos (impuestos / proveedores).
    const kind = String((e as { expense_kind?: unknown }).expense_kind ?? "gasto")
      .trim()
      .toLowerCase();
    if (kind === "egreso") continue;
    const raw =
      typeof e.expense_date === "string" && String(e.expense_date).length >= 10
        ? String(e.expense_date).slice(0, 10)
        : typeof e.created_at === "string" && e.created_at
          ? reportCalendarDayKeyFromIso(e.created_at)
          : null;
    if (!raw) continue;
    const amount = Number(e.amount_cents ?? 0);
    if (!dayInRange(raw, rangeFrom, rangeTo)) continue;
    egresosPeriod += amount;
    cantidadEgresosPeriod += 1;
    const pm = String(e.payment_method ?? "").trim().toLowerCase();
    const line: ReportExpenseDetailLine = {
      id: String(e.id),
      concept: String((e as { concept?: string }).concept ?? ""),
      amount_cents: amount,
      expense_date: raw,
      payment_method: String((e as { payment_method?: string }).payment_method ?? ""),
      category:
        (e as { category?: string | null }).category != null
          ? String((e as { category?: string | null }).category)
          : null,
      created_at:
        typeof (e as { created_at?: string }).created_at === "string"
          ? (e as { created_at: string }).created_at
          : null,
    };
    if (pm === "efectivo") {
      egresosEfectivoCents += amount;
      reportExpensesEfectivoLines.push(line);
    } else {
      egresosTransferenciaBucketCents += amount;
      reportExpensesOtrosLines.push(line);
    }
  }

  const compareReportExpenseLines = (
    a: ReportExpenseDetailLine,
    b: ReportExpenseDetailLine,
  ) => {
    const byDate = b.expense_date.localeCompare(a.expense_date);
    if (byDate !== 0) return byDate;
    return (b.created_at ?? "").localeCompare(a.created_at ?? "");
  };
  reportExpensesEfectivoLines.sort(compareReportExpenseLines);
  reportExpensesOtrosLines.sort(compareReportExpenseLines);

  const gananciaNeta = gananciaBruta - egresosPeriod;
  const efectivoNetoCaja = efectivo - egresosEfectivoCents;
  const transferenciaNeta = transferencia - egresosTransferenciaBucketCents;

  const incomeByDay = new Map<string, { income: number; count: number }>();
  for (const key of dayKeysInclusiveReport(
    opts.salesTrendPriorFrom,
    opts.salesTrendCurrentTo,
  )) {
    incomeByDay.set(key, { income: 0, count: 0 });
  }

  for (const o of paidOrdersForChart) {
    if (isPosDeferredIncome(o.wompi_reference)) continue;
    const key = reportCalendarDayKeyFromIso(o.created_at);
    const cur = incomeByDay.get(key);
    if (!cur) continue;
    const { gross } = revenueNetGrossFromLines(o, orderItems, productsById);
    cur.income += gross;
    cur.count += 1;
  }

  for (const pay of paymentsResult.rows ?? []) {
    if (!pay.paid_at) continue;
    const key = reportCalendarDayKeyFromIso(pay.paid_at);
    const cur = incomeByDay.get(key);
    if (!cur) continue;
    cur.income += Math.max(0, Math.floor(Number(pay.amount_cents ?? 0)));
  }

  const {
    points: reportIncomeChartPoints,
    comparison: salesTrendComparison,
    peakIncomeDayKey,
    peakIncomeDayCents,
  } = buildSalesTrendFromIncomeMap(
    incomeByDay,
    opts.salesTrendCurrentFrom,
    opts.salesTrendCurrentTo,
    opts.salesTrendPriorFrom,
    opts.salesTrendPriorTo,
  );

  const stockInvestmentTrend = null;

  return {
    periodLabel,
    rangeFrom,
    rangeTo,
    chartFrom,
    chartTo,
    salesTrendCurrentFrom: opts.salesTrendCurrentFrom,
    salesTrendCurrentTo: opts.salesTrendCurrentTo,
    salesTrendComparison,
    stockInversionNet: stockTotals.netCents,
    stockInversionGross: stockTotals.grossCents,
    stockHasProducts: stockTotals.productCount > 0,
    stockHasGrossCost: stockTotals.grossCents > 0,
    stockInvestmentTrend,
    ingresosSinIvaPeriod,
    ingresosConIvaPeriod,
    ivaRecaudadoPeriod,
    gananciaBruta,
    gananciaNeta,
    totalCobradoPedidos,
    efectivo,
    transferencia,
    anuladas,
    ventasVirtuales,
    ventasPagadasPeriod,
    egresosPeriod,
    egresosEfectivoCents,
    egresosTransferenciaBucketCents,
    cantidadEgresosPeriod,
    efectivoNetoCaja,
    transferenciaNeta,
    reportExpensesEfectivoLines,
    reportExpensesOtrosLines,
    reportIncomeChartPoints,
    peakIncomeDayKey,
    peakIncomeDayCents,
    ordersRangeError: ordersResult.error ?? expensesRes.error,
    revenueApproxFromOrderTotals,
  };
}

export async function fetchAdminReportDashboardData(
  supabase: SupabaseClient,
  opts: ReportFetchOpts,
): Promise<AdminReportDashboardData> {
  try {
    const viaRpc = await fetchAdminReportViaRpc(supabase, opts);
    if (viaRpc) return viaRpc;
  } catch (err) {
    console.error("[admin reportes] rpc exception:", err);
  }

  console.warn("[admin reportes] RPC no disponible; usando consulta legacy.");

  try {
    const viaLegacy = await fetchAdminReportViaLegacy(supabase, opts);
    if (viaLegacy) return viaLegacy;
  } catch (err) {
    console.error("[admin reportes] legacy exception:", err);
  }

  return buildEmptyReport(
    opts,
    "No se pudieron cargar los reportes. Reintentá en unos segundos.",
  );
}
