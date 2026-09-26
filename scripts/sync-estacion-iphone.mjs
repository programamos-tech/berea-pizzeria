#!/usr/bin/env node
/**
 * Sync incremental: Estación iPhone (Nou) → tenant `estacion-iphone`.
 * Trae lo que falte desde la última migración: categorías, productos, stock,
 * clientes, ventas, egresos, cierres de caja y eventos mapeables.
 * No toca Aleya ni Berea Tech.
 *
 *   node scripts/sync-estacion-iphone.mjs          # dry-run
 *   node scripts/sync-estacion-iphone.mjs --apply
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const ISAAC_ORG_ID = "9fd9cc05-ff94-44ed-a9ee-7087e01338cc";
const ISAAC_BRANCH_ID = "06c2f39f-cbb3-4f74-89e6-9913422becb1";
const TENANT_SLUG = "estacion-iphone";
const APPLY = process.argv.includes("--apply");

const ACTIVITY_MAP = {
  sale_created: "sale_created",
  sale_cancelled: "sale_cancelled",
  sale_canceled: "sale_cancelled",
  product_created: "product_created",
  product_updated: "product_updated",
  stock_adjusted: "stock_adjusted",
  stock_transferred: "stock_transferred",
  customer_created: "customer_created",
  customer_updated: "customer_updated",
  cash_session_opened: "cash_session_opened",
  cash_session_closed: "cash_session_closed",
  cash_closing_created: "cash_session_closed",
  cash_closed: "cash_session_closed",
};

function parseEnvFile(p) {
  const out = {};
  if (!existsSync(p)) return out;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadEnvIntoProcess(p, { overwrite = false } = {}) {
  const parsed = parseEnvFile(p);
  for (const [k, v] of Object.entries(parsed)) {
    if (!v || /\[SENSITIVE\]/i.test(v)) continue;
    if (!process.env[k] || overwrite) process.env[k] = v;
  }
}

function pesos(v) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function posRef(method) {
  const m = String(method ?? "").toLowerCase();
  if (m === "cash" || m === "efectivo") return "POS:cash";
  if (m === "transfer" || m === "transferencia") return "POS:transfer";
  if (m === "mixed" || m === "mixto") return "POS:mixed";
  return "POS:cash";
}

function saleStatus(raw) {
  const s = String(raw ?? "").toLowerCase();
  if (s === "cancelled" || s === "canceled" || s === "anulada") return "cancelled";
  if (s === "pending" || s === "payment_pending" || s === "packing") return "pending";
  if (s === "failed") return "failed";
  return "paid";
}

function normName(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase();
}

function normSku(v) {
  return String(v ?? "").trim().toUpperCase();
}

function phoneDigits(v) {
  return String(v ?? "").replace(/\D/g, "");
}

function invoiceKey(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

function bogotaYmd(iso) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

async function fetchAll(client, table, columns, apply) {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  for (;;) {
    let q = client.from(table).select(columns).range(from, from + pageSize - 1);
    if (apply) q = apply(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function insertChunks(client, table, rows, chunkSize = 80) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await client.from(table).insert(chunk);
    if (error) throw new Error(`${table} insert @${i}: ${error.message}`);
  }
}

async function countEq(client, table, col, id) {
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(col, id);
  if (error) throw new Error(`${table} count: ${error.message}`);
  return count ?? 0;
}

async function main() {
  loadEnvIntoProcess(join(root, ".env.production.local"));
  loadEnvIntoProcess(join(root, ".env.local"), { overwrite: true });

  const bereaUrl =
    process.env.BEREA_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const bereaKey =
    process.env.BEREA_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  const nouLocal = parseEnvFile(
    join("/Users/programamos.st/Developer/nou/berea-tech", ".env.local"),
  );
  let nouUrl = process.env.NOU_SUPABASE_URL || nouLocal.NEXT_PUBLIC_SUPABASE_URL;
  let nouKey =
    process.env.NOU_SUPABASE_SERVICE_ROLE_KEY || nouLocal.SUPABASE_SERVICE_ROLE_KEY;

  if (!nouUrl || /127\.0\.0\.1|localhost/.test(nouUrl)) {
    const solucion = join(
      "/Users/programamos.st/Developer/nou/berea-tech",
      "SOLUCION_ERROR_ORGANIZACION.md",
    );
    if (existsSync(solucion)) {
      const md = readFileSync(solucion, "utf8");
      nouUrl =
        (md.match(/NEXT_PUBLIC_SUPABASE_URL`\s*=\s*`([^`]+)`/) || [])[1] || nouUrl;
      nouKey =
        (md.match(/SUPABASE_SERVICE_ROLE_KEY`\s*=\s*`([^`]+)`/) || [])[1] || nouKey;
    }
  }

  if (!bereaUrl || !bereaKey) throw new Error("Faltan credenciales Berea");
  if (!nouUrl || !nouKey) throw new Error("Faltan credenciales Nou");
  if (/127\.0\.0\.1|localhost/.test(nouUrl) || /127\.0\.0\.1|localhost/.test(bereaUrl)) {
    throw new Error("Hace falta producción, no localhost.");
  }

  const berea = createClient(bereaUrl, bereaKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const nou = createClient(nouUrl, nouKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: tenant, error: tErr } = await berea
    .from("tenants")
    .select("id, slug")
    .eq("slug", TENANT_SLUG)
    .single();
  if (tErr || !tenant?.id) throw new Error(tErr?.message ?? "No existe tenant estacion-iphone");
  const tenantId = tenant.id;

  const { data: aleya } = await berea.from("tenants").select("id").eq("slug", "aleya").single();
  const { data: bereaTech } = await berea
    .from("tenants")
    .select("id")
    .eq("slug", "berea-tech")
    .maybeSingle();
  const aleyaBefore = {
    products: await countEq(berea, "products", "tenant_id", aleya.id),
    orders: await countEq(berea, "orders", "tenant_id", aleya.id),
  };
  const techBefore = bereaTech?.id
    ? {
        products: await countEq(berea, "products", "tenant_id", bereaTech.id),
        orders: await countEq(berea, "orders", "tenant_id", bereaTech.id),
      }
    : null;

  const { data: branch } = await berea
    .from("branches")
    .select("id,name,code,is_default")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .limit(1)
    .single();
  if (!branch?.id) throw new Error("Estación iPhone no tiene sucursal");
  const branchId = branch.id;

  const { data: staffRows } = await berea
    .from("profiles")
    .select("id, public_email, display_name, job_role")
    .eq("tenant_id", tenantId);
  const staffByEmail = new Map(
    (staffRows ?? [])
      .filter((p) => p.public_email)
      .map((p) => [String(p.public_email).toLowerCase(), p.id]),
  );
  const fallbackActor =
    (staffRows ?? []).find((p) => p.job_role === "owner")?.id ||
    (staffRows ?? [])[0]?.id;
  if (!fallbackActor) throw new Error("No hay perfiles en Estación iPhone");

  let orgId = ISAAC_ORG_ID;
  let nouBranchId = ISAAC_BRANCH_ID;
  const { data: orgs } = await nou.from("organizations").select("id,name");
  const namedOrg = (orgs ?? []).find((o) =>
    /estacion|iphone/i.test(String(o.name ?? "")),
  );
  if (namedOrg?.id) orgId = namedOrg.id;
  const { data: nouBranches } = await nou
    .from("branches")
    .select("id,name,organization_id")
    .eq("organization_id", orgId);
  const namedBranch = (nouBranches ?? []).find((b) =>
    /estacion|iphone/i.test(String(b.name ?? "")),
  );
  if (namedBranch?.id) nouBranchId = namedBranch.id;

  console.log(APPLY ? "MODO: aplicar" : "MODO: dry-run (pasa --apply para escribir)");
  console.log("Nou", new URL(nouUrl).host, "org", namedOrg?.name ?? orgId);
  console.log("Berea tenant", tenantId, "sucursal", branch.name, branch.code);

  const categories = await fetchAll(
    nou,
    "categories",
    "id,name,display_order,created_at",
    (q) => q.eq("organization_id", orgId),
  );
  const products = await fetchAll(
    nou,
    "products",
    "id,name,sku,brand,base_cost,base_price,apply_iva,category_id,description,created_at,updated_at",
    (q) => q.eq("organization_id", orgId),
  );
  const inventory = await fetchAll(
    nou,
    "inventory",
    "product_id,quantity,branch_id",
    (q) => q.eq("branch_id", nouBranchId),
  );
  const customersNou = await fetchAll(
    nou,
    "customers",
    "id,name,email,phone,created_at",
    (q) => q.eq("organization_id", orgId),
  );
  const sales = await fetchAll(
    nou,
    "sales",
    "id,invoice_number,status,payment_method,notes,amount_cash,amount_transfer,customer_id,total,created_at,updated_at",
    (q) => q.eq("branch_id", nouBranchId),
  );

  let expenses = [];
  try {
    expenses = await fetchAll(
      nou,
      "expenses",
      "id,amount,payment_method,concept,notes,status,created_at,cancelled_at,cancellation_reason",
      (q) => q.eq("branch_id", nouBranchId),
    );
  } catch (err) {
    console.warn("Egresos Nou:", err.message);
  }

  let cashClosings = [];
  try {
    cashClosings = await fetchAll(
      nou,
      "cash_closings",
      "id,user_id,closing_date,expected_cash,expected_transfer,actual_cash,actual_transfer,cash_difference,total_sales,total_units,notes,created_at",
      (q) => q.eq("branch_id", nouBranchId),
    );
  } catch (err) {
    console.warn("Caja Nou:", err.message);
  }

  let activities = [];
  try {
    activities = await fetchAll(
      nou,
      "activities",
      "id,user_id,action,entity_type,entity_id,summary,metadata,created_at",
      (q) => q.eq("organization_id", orgId),
    );
  } catch (err) {
    console.warn("Eventos Nou:", err.message);
  }

  let nouUsers = [];
  try {
    nouUsers = await fetchAll(nou, "users", "id,email,name,full_name", (q) =>
      q.eq("organization_id", orgId),
    );
  } catch {
    try {
      nouUsers = await fetchAll(nou, "users", "id,email");
    } catch (err) {
      console.warn("Users Nou:", err.message);
    }
  }

  const saleIds = sales.map((s) => s.id);
  const saleItems = [];
  for (let i = 0; i < saleIds.length; i += 200) {
    const batch = saleIds.slice(i, i + 200);
    const { data, error } = await nou
      .from("sale_items")
      .select(
        "id,sale_id,product_id,quantity,unit_price,discount_percent,discount_amount",
      )
      .in("sale_id", batch);
    if (error) throw new Error(`sale_items: ${error.message}`);
    saleItems.push(...(data ?? []));
  }

  const stockByProduct = new Map();
  for (const row of inventory) {
    const pid = String(row.product_id);
    stockByProduct.set(
      pid,
      (stockByProduct.get(pid) ?? 0) +
        Math.max(0, Math.floor(Number(row.quantity ?? 0))),
    );
  }

  const existingCats = await fetchAll(
    berea,
    "categories",
    "id,name",
    (q) => q.eq("tenant_id", tenantId),
  );
  const existingProducts = await fetchAll(
    berea,
    "products",
    "id,name,reference,stock_local,price_cents,cost_cents",
    (q) => q.eq("tenant_id", tenantId),
  );
  const existingCustomers = await fetchAll(
    berea,
    "customers",
    "id,name,email,phone,branch_id",
    (q) => q.eq("tenant_id", tenantId),
  );
  const existingOrders = await fetchAll(
    berea,
    "orders",
    "id,wompi_transaction_id,created_at,total_cents",
    (q) => q.eq("tenant_id", tenantId),
  );
  const existingExpenses = await fetchAll(
    berea,
    "store_expenses",
    "id,concept,amount_cents,created_at,expense_date",
    (q) => q.eq("tenant_id", tenantId),
  );
  const existingCash = await fetchAll(
    berea,
    "cash_register_sessions",
    "id,business_day",
    (q) => q.eq("tenant_id", tenantId),
  );
  const existingActs = await fetchAll(
    berea,
    "admin_activity_log",
    "id,summary,created_at,action_type",
    (q) => q.eq("tenant_id", tenantId),
  );

  const catIdMap = new Map();
  const catByName = new Map(
    existingCats.map((c) => [normName(c.name), c.id]),
  );
  const newCats = [];
  for (const c of categories) {
    const key = normName(c.name) || "sin categoria";
    let id = catByName.get(key);
    if (!id) {
      id = randomUUID();
      catByName.set(key, id);
      newCats.push({
        id,
        tenant_id: tenantId,
        name: String(c.name ?? "Sin categoría").trim() || "Sin categoría",
        sort_order: Number.isFinite(Number(c.display_order))
          ? Number(c.display_order)
          : newCats.length,
        icon_key: "tag",
        created_at: c.created_at ?? new Date().toISOString(),
      });
    }
    catIdMap.set(String(c.id), id);
  }

  const productIdMap = new Map();
  const prodBySku = new Map();
  const prodByName = new Map();
  for (const p of existingProducts) {
    const sku = normSku(p.reference);
    if (sku) prodBySku.set(sku, p);
    prodByName.set(normName(p.name), p);
  }
  const newProducts = [];
  const stockUpdates = [];
  for (const p of products) {
    const sku = normSku(p.sku);
    const nameKey = normName(p.name);
    const existing = (sku && prodBySku.get(sku)) || prodByName.get(nameKey);
    const stock = stockByProduct.get(String(p.id)) ?? 0;
    const price = pesos(p.base_price);
    const cost = pesos(p.base_cost);
    if (existing) {
      productIdMap.set(String(p.id), existing.id);
      if (
        existing.stock_local !== stock ||
        existing.price_cents !== price ||
        existing.cost_cents !== cost
      ) {
        stockUpdates.push({
          id: existing.id,
          stock_local: stock,
          price_cents: price,
          cost_cents: cost,
          cost_gross_cents: cost,
        });
      }
      continue;
    }
    const id = randomUUID();
    productIdMap.set(String(p.id), id);
    const row = {
      id,
      tenant_id: tenantId,
      name: String(p.name ?? "Producto").trim() || "Producto",
      description: String(p.description ?? ""),
      reference: sku,
      brand: String(p.brand ?? "").trim(),
      price_cents: price,
      cost_cents: cost,
      cost_gross_cents: cost,
      has_vat: Boolean(p.apply_iva),
      vat_percent: p.apply_iva ? 19 : null,
      category_id: p.category_id ? catIdMap.get(String(p.category_id)) ?? null : null,
      stock_local: stock,
      stock_warehouse: 0,
      is_published: false,
      currency: "COP",
      created_at: p.created_at ?? new Date().toISOString(),
      updated_at: p.updated_at ?? p.created_at ?? new Date().toISOString(),
    };
    newProducts.push(row);
    if (sku) prodBySku.set(sku, row);
    prodByName.set(nameKey, row);
  }

  const customerIdMap = new Map();
  const custByPhone = new Map();
  const custByEmail = new Map();
  const custByName = new Map();
  for (const c of existingCustomers) {
    const phone = phoneDigits(c.phone);
    if (phone.length >= 7) custByPhone.set(phone, c.id);
    const email = String(c.email ?? "").trim().toLowerCase();
    if (email.includes("@")) custByEmail.set(email, c.id);
    custByName.set(normName(c.name), c.id);
  }
  const newCustomers = [];
  for (const c of customersNou) {
    const phone = phoneDigits(c.phone);
    const email = String(c.email ?? "").trim().toLowerCase();
    const existingId =
      (phone.length >= 7 && custByPhone.get(phone)) ||
      (email.includes("@") && custByEmail.get(email)) ||
      custByName.get(normName(c.name));
    if (existingId) {
      customerIdMap.set(String(c.id), existingId);
      continue;
    }
    const id = randomUUID();
    customerIdMap.set(String(c.id), id);
    newCustomers.push({
      id,
      tenant_id: tenantId,
      branch_id: branchId,
      name: String(c.name ?? "Cliente").trim() || "Cliente",
      email: email.includes("@") ? email : null,
      phone: String(c.phone ?? "").trim() || null,
      source: "manual",
      created_at: c.created_at ?? new Date().toISOString(),
    });
    if (phone.length >= 7) custByPhone.set(phone, id);
    if (email.includes("@")) custByEmail.set(email, id);
    custByName.set(normName(c.name), id);
  }

  const orderIdMap = new Map();
  const orderByInvoice = new Map();
  const orderByStamp = new Map();
  for (const o of existingOrders) {
    const inv = invoiceKey(o.wompi_transaction_id);
    if (inv) orderByInvoice.set(inv, o.id);
    const stamp = `${new Date(o.created_at).toISOString().slice(0, 19)}|${o.total_cents}`;
    orderByStamp.set(stamp, o.id);
  }
  const newOrders = [];
  for (const s of sales) {
    const inv = invoiceKey(s.invoice_number);
    const stamp = `${new Date(s.created_at).toISOString().slice(0, 19)}|${pesos(s.total)}`;
    const existingId =
      (inv && orderByInvoice.get(inv)) || orderByStamp.get(stamp);
    if (existingId) {
      orderIdMap.set(String(s.id), existingId);
      continue;
    }
    const id = randomUUID();
    orderIdMap.set(String(s.id), id);
    const method = posRef(s.payment_method);
    const cash = pesos(s.amount_cash);
    const transfer = pesos(s.amount_transfer);
    const customerName =
      (s.customer_id &&
        customersNou.find((c) => String(c.id) === String(s.customer_id))?.name) ||
      "Cliente Final";
    newOrders.push({
      id,
      tenant_id: tenantId,
      branch_id: branchId,
      status: saleStatus(s.status),
      customer_id: s.customer_id
        ? customerIdMap.get(String(s.customer_id)) ?? null
        : null,
      customer_name: customerName,
      customer_email: "pos@estacion-iphone.local",
      total_cents: pesos(s.total),
      currency: "COP",
      checkout_payment_method: "wompi",
      wompi_reference: method,
      wompi_transaction_id: inv || null,
      pos_mixed_cash_cents: method === "POS:mixed" ? cash : null,
      pos_mixed_transfer_cents: method === "POS:mixed" ? transfer : null,
      shipping_cents: 0,
      created_at: s.created_at ?? new Date().toISOString(),
      updated_at: s.updated_at ?? s.created_at ?? new Date().toISOString(),
    });
  }

  const productNameByOldId = new Map(
    products.map((p) => [String(p.id), String(p.name ?? "Producto")]),
  );
  const newItems = [];
  const newOrderIds = new Set(newOrders.map((o) => o.id));
  for (const it of saleItems) {
    const orderId = orderIdMap.get(String(it.sale_id));
    if (!orderId || !newOrderIds.has(orderId)) continue;
    const qty = Math.max(1, Math.floor(Number(it.quantity ?? 1)));
    const pct = Number(it.discount_percent ?? 0);
    const amt = pesos(it.discount_amount);
    newItems.push({
      tenant_id: tenantId,
      order_id: orderId,
      product_id: it.product_id
        ? productIdMap.get(String(it.product_id)) ?? null
        : null,
      quantity: qty,
      unit_price_cents: pesos(it.unit_price),
      product_name_snapshot:
        (it.product_id && productNameByOldId.get(String(it.product_id))) ||
        "Producto",
      line_discount_percent:
        Number.isFinite(pct) && pct > 0 && pct <= 100 ? Math.floor(pct) : null,
      line_discount_amount_cents: amt,
      stock_deducted_local: 0,
      stock_deducted_warehouse: 0,
    });
  }

  const expenseKeys = new Set(
    existingExpenses.map(
      (e) =>
        `${bogotaYmd(e.created_at)}|${e.amount_cents}|${normName(e.concept)}`,
    ),
  );
  const newExpenses = [];
  for (const e of expenses) {
    const amount = pesos(e.amount);
    const key = `${bogotaYmd(e.created_at)}|${amount}|${normName(e.concept)}`;
    if (expenseKeys.has(key)) continue;
    expenseKeys.add(key);
    const method = String(e.payment_method ?? "").toLowerCase();
    newExpenses.push({
      tenant_id: tenantId,
      branch_id: branchId,
      concept: String(e.concept ?? "Egreso").trim() || "Egreso",
      category: "operativo",
      amount_cents: amount,
      payment_method: method === "cash" ? "efectivo" : "transferencia",
      notes: String(e.notes ?? "").trim() || null,
      expense_date: bogotaYmd(e.created_at),
      expense_kind: "gasto",
      expense_scope: "diario",
      is_cancelled: String(e.status ?? "") === "cancelled",
      cancelled_at: e.cancelled_at ?? null,
      cancellation_reason: e.cancellation_reason ?? null,
      created_at: e.created_at ?? new Date().toISOString(),
    });
  }

  const cashDays = new Set(
    existingCash.map((c) => String(c.business_day).slice(0, 10)),
  );
  const newCash = [];
  for (const c of cashClosings) {
    const day = String(c.closing_date).slice(0, 10);
    if (cashDays.has(day)) continue;
    cashDays.add(day);
    const actor =
      staffByEmail.get(
        String(
          nouUsers.find((u) => String(u.id) === String(c.user_id))?.email ?? "",
        ).toLowerCase(),
      ) || fallbackActor;
    const expected = pesos(c.expected_cash);
    const counted = pesos(c.actual_cash);
    newCash.push({
      tenant_id: tenantId,
      branch_id: branchId,
      business_day: day,
      status: "closed",
      opening_float_cents: 0,
      opened_at: `${day}T13:00:00.000Z`,
      opened_by: actor,
      closed_at: c.created_at ?? `${day}T00:00:00.000Z`,
      closed_by: actor,
      sales_count: Number(c.total_sales ?? 0),
      sales_total_cents: pesos(c.expected_cash) + pesos(c.expected_transfer),
      sales_cash_cents: pesos(c.expected_cash),
      sales_transfer_cents: pesos(c.expected_transfer),
      sales_mixed_cents: 0,
      sales_other_cents: 0,
      expenses_cash_cents: 0,
      expenses_other_cents: 0,
      expected_cash_cents: expected,
      counted_cash_cents: counted,
      cash_difference_cents: pesos(c.cash_difference) || counted - expected,
      units_sold: Number(c.total_units ?? 0),
      stock_out_lines: [],
      expense_lines: [],
      notes: String(c.notes ?? "").trim() || "Migrado desde Nou",
      created_at: c.created_at ?? new Date().toISOString(),
    });
  }

  const actKeys = new Set(
    existingActs.map(
      (a) =>
        `${new Date(a.created_at).toISOString().slice(0, 19)}|${normName(a.summary)}`,
    ),
  );
  const userEmailById = new Map(
    nouUsers.map((u) => [String(u.id), String(u.email ?? "").toLowerCase()]),
  );
  const newActs = [];
  let skippedActs = 0;
  for (const a of activities) {
    const mapped = ACTIVITY_MAP[String(a.action ?? "")];
    if (!mapped) {
      skippedActs += 1;
      continue;
    }
    const key = `${new Date(a.created_at).toISOString().slice(0, 19)}|${normName(a.summary)}`;
    if (actKeys.has(key)) continue;
    actKeys.add(key);
    const email = userEmailById.get(String(a.user_id ?? "")) || "";
    const actorId = staffByEmail.get(email) || fallbackActor;
    let entityId = null;
    if (a.entity_id && a.entity_type === "sale") {
      entityId = orderIdMap.get(String(a.entity_id)) ?? null;
    } else if (a.entity_id && a.entity_type === "product") {
      entityId = productIdMap.get(String(a.entity_id)) ?? null;
    } else if (a.entity_id && a.entity_type === "customer") {
      entityId = customerIdMap.get(String(a.entity_id)) ?? null;
    }
    newActs.push({
      tenant_id: tenantId,
      branch_id: branchId,
      actor_id: actorId,
      action_type: mapped,
      entity_type: a.entity_type ?? null,
      entity_id: entityId,
      summary: String(a.summary ?? mapped).slice(0, 500),
      metadata: {
        ...(a.metadata && typeof a.metadata === "object" ? a.metadata : {}),
        nou_activity_id: a.id,
        nou_action: a.action,
      },
      created_at: a.created_at ?? new Date().toISOString(),
    });
  }

  const summary = {
    categorias_nuevas: newCats.length,
    productos_nuevos: newProducts.length,
    productos_stock_precio: stockUpdates.length,
    clientes_nuevos: newCustomers.length,
    ventas_nuevas: newOrders.length,
    items_venta: newItems.length,
    egresos_nuevos: newExpenses.length,
    cierres_caja: newCash.length,
    eventos_nuevos: newActs.length,
    eventos_sin_mapeo: skippedActs,
    nou: {
      cats: categories.length,
      products: products.length,
      sales: sales.length,
      expenses: expenses.length,
      cash: cashClosings.length,
      activities: activities.length,
    },
    berea_antes: {
      cats: existingCats.length,
      products: existingProducts.length,
      customers: existingCustomers.length,
      orders: existingOrders.length,
      expenses: existingExpenses.length,
      cash: existingCash.length,
      activities: existingActs.length,
    },
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!APPLY) {
    console.log("Dry-run. Nada se escribió.");
    return;
  }

  if (newCats.length) await insertChunks(berea, "categories", newCats);
  if (newProducts.length) await insertChunks(berea, "products", newProducts, 40);
  for (const p of newProducts) {
    const { error } = await berea
      .from("branch_inventory")
      .update({ quantity: p.stock_local })
      .eq("branch_id", branchId)
      .eq("product_id", p.id);
    if (error) throw new Error(`branch_inventory new: ${error.message}`);
  }
  for (const u of stockUpdates) {
    const { error } = await berea
      .from("products")
      .update({
        stock_local: u.stock_local,
        price_cents: u.price_cents,
        cost_cents: u.cost_cents,
        cost_gross_cents: u.cost_gross_cents,
      })
      .eq("id", u.id)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(`product update: ${error.message}`);
    const { error: invErr } = await berea
      .from("branch_inventory")
      .update({ quantity: u.stock_local })
      .eq("branch_id", branchId)
      .eq("product_id", u.id);
    if (invErr) throw new Error(`branch_inventory update: ${invErr.message}`);
  }
  if (newCustomers.length) await insertChunks(berea, "customers", newCustomers);
  if (newOrders.length) await insertChunks(berea, "orders", newOrders, 60);
  if (newItems.length) await insertChunks(berea, "order_items", newItems, 80);
  if (newExpenses.length) await insertChunks(berea, "store_expenses", newExpenses);
  if (newCash.length) await insertChunks(berea, "cash_register_sessions", newCash, 40);
  if (newActs.length) await insertChunks(berea, "admin_activity_log", newActs, 80);

  const aleyaAfter = {
    products: await countEq(berea, "products", "tenant_id", aleya.id),
    orders: await countEq(berea, "orders", "tenant_id", aleya.id),
  };
  if (
    aleyaAfter.products !== aleyaBefore.products ||
    aleyaAfter.orders !== aleyaBefore.orders
  ) {
    throw new Error(
      `Aleya cambió: productos ${aleyaBefore.products}→${aleyaAfter.products}, ventas ${aleyaBefore.orders}→${aleyaAfter.orders}`,
    );
  }
  if (techBefore && bereaTech?.id) {
    const techAfter = {
      products: await countEq(berea, "products", "tenant_id", bereaTech.id),
      orders: await countEq(berea, "orders", "tenant_id", bereaTech.id),
    };
    if (
      techAfter.products !== techBefore.products ||
      techAfter.orders !== techBefore.orders
    ) {
      throw new Error("Berea Tech cambió; abortando verificación.");
    }
  }

  const after = {
    products: await countEq(berea, "products", "tenant_id", tenantId),
    orders: await countEq(berea, "orders", "tenant_id", tenantId),
    customers: await countEq(berea, "customers", "tenant_id", tenantId),
    expenses: await countEq(berea, "store_expenses", "tenant_id", tenantId),
    cash: await countEq(berea, "cash_register_sessions", "tenant_id", tenantId),
    activities: await countEq(berea, "admin_activity_log", "tenant_id", tenantId),
  };
  console.log("Estación iPhone ahora", after);
  console.log("Aleya intacta", aleyaAfter);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
