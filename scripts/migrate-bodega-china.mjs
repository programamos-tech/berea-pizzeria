#!/usr/bin/env node
/**
 * Migra Bodega China (Zonat) → tenant `toro-technology`.
 *
 *   node scripts/migrate-bodega-china.mjs          # dry-run
 *   node scripts/migrate-bodega-china.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const ZONAT_STORE_ID = "b2976c51-0343-4f33-a25d-7b956e3fd574";
const TENANT_SLUG = "toro-technology";
const APPLY = process.argv.includes("--apply");
const POS_CREDIT_REF = "POS:credit";

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

function invoiceKey(v) {
  return String(v ?? "").trim();
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

async function upsertInventory(client, rows) {
  for (let i = 0; i < rows.length; i += 80) {
    const chunk = rows.slice(i, i + 80);
    const { error } = await client.from("branch_inventory").upsert(chunk, {
      onConflict: "branch_id,product_id",
    });
    if (error) throw new Error(`branch_inventory upsert @${i}: ${error.message}`);
  }
}

function payMethod(raw) {
  const v = String(raw ?? "").toLowerCase();
  if (v === "transfer" || v === "transferencia") return "transfer";
  return "cash";
}

function documentType(client) {
  const digits = String(client.document ?? "").replace(/\D/g, "");
  const kind = String(client.type ?? "").toLowerCase();
  if (kind === "mayorista" || digits.length >= 9) return "nit";
  return "cc";
}

async function main() {
  loadEnvIntoProcess(join(root, ".env.local"));
  const zonatEnv = parseEnvFile(
    join("/Users/programamos.st/Developer/zonat", ".env.vercel.production"),
  );

  const bereaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const bereaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const zonatUrl = zonatEnv.NEXT_PUBLIC_SUPABASE_URL;
  const zonatKey = zonatEnv.SUPABASE_SERVICE_ROLE_KEY;

  if (!bereaUrl || !bereaKey) throw new Error("Faltan credenciales Berea");
  if (!zonatUrl || !zonatKey) throw new Error("Faltan credenciales Zonat");
  if (/127\.0\.0\.1|localhost/.test(bereaUrl) || /127\.0\.0\.1|localhost/.test(zonatUrl)) {
    throw new Error("Hace falta producción, no localhost.");
  }

  const berea = createClient(bereaUrl, bereaKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const zonat = createClient(zonatUrl, zonatKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: tenant, error: tErr } = await berea
    .from("tenants")
    .select("id, slug")
    .eq("slug", TENANT_SLUG)
    .single();
  if (tErr || !tenant?.id) throw new Error("No existe tenant toro-technology");
  const tenantId = tenant.id;

  const { data: branch } = await berea
    .from("branches")
    .select("id,name,code")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .limit(1)
    .single();
  if (!branch?.id) throw new Error("Toro Technology no tiene sucursal");
  const branchId = branch.id;

  const { data: owner } = await berea
    .from("profiles")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("job_role", "owner")
    .maybeSingle();
  const actorId = owner?.id ?? null;

  console.log(APPLY ? "MODO: aplicar" : "MODO: dry-run (pasa --apply para escribir)");
  console.log("Zonat store Bodega China", ZONAT_STORE_ID);
  console.log("Berea tenant", tenantId, branch.name, branch.code);

  const stockRows = await fetchAll(
    zonat,
    "store_stock",
    "product_id,quantity,price,cost,updated_at",
    (q) => q.eq("store_id", ZONAT_STORE_ID),
  );
  const sales = await fetchAll(
    zonat,
    "sales",
    "id,client_id,client_name,total,status,payment_method,invoice_number,created_at,updated_at,cancellation_reason,customer_phone,customer_email,customer_address",
    (q) => q.eq("store_id", ZONAT_STORE_ID),
  );
  const clients = await fetchAll(
    zonat,
    "clients",
    "id,name,email,phone,document,address,city,notes,type,created_at,updated_at",
    (q) => q.eq("store_id", ZONAT_STORE_ID),
  );

  const saleIds = sales.map((s) => s.id);
  const saleItems = [];
  for (let i = 0; i < saleIds.length; i += 200) {
    const batch = saleIds.slice(i, i + 200);
    const { data, error } = await zonat
      .from("sale_items")
      .select(
        "id,sale_id,product_id,product_name,product_reference_code,quantity,unit_price,discount,discount_type,total",
      )
      .in("sale_id", batch);
    if (error) throw new Error(`sale_items: ${error.message}`);
    saleItems.push(...(data ?? []));
  }

  const payments = [];
  for (let i = 0; i < saleIds.length; i += 200) {
    const batch = saleIds.slice(i, i + 200);
    const { data, error } = await zonat
      .from("payments")
      .select("id,sale_id,invoice_number")
      .in("sale_id", batch);
    if (error) throw new Error(`payments: ${error.message}`);
    payments.push(...(data ?? []));
  }
  const paymentIds = payments.map((p) => p.id);
  const paymentRecords = [];
  for (let i = 0; i < paymentIds.length; i += 200) {
    const batch = paymentIds.slice(i, i + 200);
    const { data, error } = await zonat
      .from("payment_records")
      .select(
        "id,payment_id,amount,payment_date,payment_method,description,status,created_at",
      )
      .in("payment_id", batch);
    if (error) throw new Error(`payment_records: ${error.message}`);
    paymentRecords.push(...(data ?? []));
  }

  const productIds = [
    ...new Set([
      ...stockRows.map((r) => String(r.product_id)),
      ...saleItems.map((r) => String(r.product_id)).filter((id) => id && id !== "null"),
    ]),
  ];
  const products = [];
  for (let i = 0; i < productIds.length; i += 200) {
    const batch = productIds.slice(i, i + 200);
    const { data, error } = await zonat
      .from("products")
      .select(
        "id,name,description,category_id,brand,reference,price,cost,status,created_at,updated_at",
      )
      .in("id", batch);
    if (error) throw new Error(`products: ${error.message}`);
    products.push(...(data ?? []));
  }

  const categoryIds = [
    ...new Set(
      products
        .map((p) => p.category_id)
        .filter(Boolean)
        .map(String),
    ),
  ];
  const categories = [];
  for (let i = 0; i < categoryIds.length; i += 200) {
    const batch = categoryIds.slice(i, i + 200);
    const { data, error } = await zonat
      .from("categories")
      .select("id,name,created_at")
      .in("id", batch);
    if (error) throw new Error(`categories: ${error.message}`);
    categories.push(...(data ?? []));
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
    "id,name,email,phone,document_id",
    (q) => q.eq("tenant_id", tenantId),
  );
  const existingOrders = await fetchAll(
    berea,
    "orders",
    "id,wompi_transaction_id,created_at,total_cents",
    (q) => q.eq("tenant_id", tenantId),
  );

  const catIdMap = new Map();
  const catByName = new Map(existingCats.map((c) => [normName(c.name), c.id]));
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
        sort_order: newCats.length,
        icon_key: "tag",
        created_at: c.created_at ?? new Date().toISOString(),
      });
    }
    catIdMap.set(String(c.id), id);
  }

  const stockByProduct = new Map();
  const priceByProduct = new Map();
  for (const row of stockRows) {
    const pid = String(row.product_id);
    stockByProduct.set(pid, Math.max(0, Math.floor(Number(row.quantity ?? 0))));
    priceByProduct.set(pid, {
      price: row.price,
      cost: row.cost,
    });
  }

  const productIdMap = new Map();
  const existingBySku = new Map();
  const existingByName = new Map();
  for (const p of existingProducts) {
    const sku = normSku(p.reference);
    if (sku) existingBySku.set(sku, p);
    existingByName.set(normName(p.name), p);
  }
  const newProducts = [];
  const usedSku = new Set([...existingBySku.keys()]);
  for (const p of products) {
    const skuRaw = normSku(p.reference);
    const nameKey = normName(p.name);
    const existing =
      (skuRaw && existingBySku.get(skuRaw)) || existingByName.get(nameKey);
    if (existing) {
      productIdMap.set(String(p.id), existing.id);
      continue;
    }
    let sku = skuRaw;
    if (sku && usedSku.has(sku)) sku = `${sku}-${String(p.id).slice(0, 6)}`;
    if (sku) usedSku.add(sku);
    const id = randomUUID();
    productIdMap.set(String(p.id), id);
    const storePrice = priceByProduct.get(String(p.id));
    const price = pesos(storePrice?.price ?? p.price);
    const cost = pesos(storePrice?.cost ?? p.cost);
    const stock = stockByProduct.get(String(p.id)) ?? 0;
    const row = {
      id,
      tenant_id: tenantId,
      name: String(p.name ?? "Producto").trim() || "Producto",
      description: String(p.description ?? ""),
      reference: sku || "",
      brand: String(p.brand ?? "").trim(),
      price_cents: price,
      cost_cents: cost,
      cost_gross_cents: cost,
      has_vat: false,
      vat_percent: null,
      category_id: p.category_id ? catIdMap.get(String(p.category_id)) ?? null : null,
      stock_local: stock,
      stock_warehouse: 0,
      is_published: false,
      currency: "COP",
      created_at: p.created_at ?? new Date().toISOString(),
      updated_at: p.updated_at ?? p.created_at ?? new Date().toISOString(),
    };
    newProducts.push(row);
  }

  const inventoryRows = [];
  for (const [oldId, qty] of stockByProduct) {
    const newId = productIdMap.get(oldId);
    if (!newId) continue;
    inventoryRows.push({
      tenant_id: tenantId,
      branch_id: branchId,
      product_id: newId,
      quantity: qty,
    });
  }

  const customerIdMap = new Map();
  const custByDoc = new Map();
  const custByName = new Map();
  for (const c of existingCustomers) {
    const doc = String(c.document_id ?? "").trim();
    if (doc) custByDoc.set(doc, c.id);
    custByName.set(normName(c.name), c.id);
  }
  const newCustomers = [];
  for (const c of clients) {
    const doc = String(c.document ?? "").trim();
    const existingId =
      (doc && custByDoc.get(doc)) || custByName.get(normName(c.name));
    if (existingId) {
      customerIdMap.set(String(c.id), existingId);
      continue;
    }
    const id = randomUUID();
    customerIdMap.set(String(c.id), id);
    const email = String(c.email ?? "").trim().toLowerCase();
    newCustomers.push({
      id,
      tenant_id: tenantId,
      branch_id: branchId,
      name: String(c.name ?? "Cliente").trim() || "Cliente",
      email: email.includes("@") ? email : null,
      phone: String(c.phone ?? "").trim() || null,
      document_id: doc || null,
      document_type: documentType(c),
      shipping_address: String(c.address ?? "").trim() || null,
      shipping_city: String(c.city ?? "").trim() || null,
      notes: String(c.notes ?? "").trim() || null,
      source: "manual",
      customer_kind: "wholesale",
      wholesale_discount_percent: 0,
      created_at: c.created_at ?? new Date().toISOString(),
      updated_at: c.updated_at ?? c.created_at ?? new Date().toISOString(),
    });
    if (doc) custByDoc.set(doc, id);
    custByName.set(normName(c.name), id);
  }

  const orderIdMap = new Map();
  const orderByInvoice = new Map();
  for (const o of existingOrders) {
    const inv = invoiceKey(o.wompi_transaction_id);
    if (inv) orderByInvoice.set(inv, o.id);
  }
  const newOrders = [];
  const clientById = new Map(clients.map((c) => [String(c.id), c]));
  for (const s of sales) {
    const inv = invoiceKey(s.invoice_number);
    if (inv && orderByInvoice.get(inv)) {
      orderIdMap.set(String(s.id), orderByInvoice.get(inv));
      continue;
    }
    const id = randomUUID();
    orderIdMap.set(String(s.id), id);
    const client = s.client_id ? clientById.get(String(s.client_id)) : null;
    const status =
      String(s.status ?? "").toLowerCase() === "cancelled" ||
      String(s.status ?? "").toLowerCase() === "canceled"
        ? "cancelled"
        : "paid";
    newOrders.push({
      id,
      tenant_id: tenantId,
      branch_id: branchId,
      status,
      customer_id: s.client_id
        ? customerIdMap.get(String(s.client_id)) ?? null
        : null,
      customer_name: String(s.client_name || client?.name || "Cliente").trim(),
      customer_email: String(s.customer_email || client?.email || "")
        .trim()
        .toLowerCase()
        .includes("@")
        ? String(s.customer_email || client?.email).trim().toLowerCase()
        : "pos@toro-technology.local",
      total_cents: pesos(s.total),
      currency: "COP",
      checkout_payment_method: "wompi",
      wompi_reference: POS_CREDIT_REF,
      wompi_transaction_id: inv || null,
      shipping_cents: 0,
      shipping_address: String(s.customer_address ?? "").trim() || null,
      shipping_phone: String(s.customer_phone ?? "").trim() || null,
      cancellation_reason: s.cancellation_reason ?? null,
      created_at: s.created_at ?? new Date().toISOString(),
      updated_at: s.updated_at ?? s.created_at ?? new Date().toISOString(),
    });
  }

  const newItems = [];
  const newOrderIds = new Set(newOrders.map((o) => o.id));
  for (const it of saleItems) {
    const orderId = orderIdMap.get(String(it.sale_id));
    if (!orderId || !newOrderIds.has(orderId)) continue;
    const qty = Math.max(1, Math.floor(Number(it.quantity ?? 1)));
    const discType = String(it.discount_type ?? "amount").toLowerCase();
    const discVal = Number(it.discount ?? 0);
    const pct =
      discType === "percentage" && Number.isFinite(discVal) && discVal > 0
        ? Math.min(100, Math.floor(discVal))
        : null;
    const amt = discType === "percentage" ? 0 : pesos(it.discount);
    newItems.push({
      tenant_id: tenantId,
      branch_id: branchId,
      order_id: orderId,
      product_id: it.product_id
        ? productIdMap.get(String(it.product_id)) ?? null
        : null,
      quantity: qty,
      unit_price_cents: pesos(it.unit_price),
      product_name_snapshot:
        String(it.product_name ?? "").trim() ||
        String(it.product_reference_code ?? "").trim() ||
        "Producto",
      line_discount_percent: pct,
      line_discount_amount_cents: amt,
      stock_deducted_local: 0,
      stock_deducted_warehouse: 0,
    });
  }

  const paymentSale = new Map(payments.map((p) => [String(p.id), String(p.sale_id)]));
  const newPayments = [];
  for (const rec of paymentRecords) {
    if (String(rec.status ?? "active").toLowerCase() === "cancelled") continue;
    const saleId = paymentSale.get(String(rec.payment_id));
    const orderId = saleId ? orderIdMap.get(saleId) : null;
    if (!orderId || !newOrderIds.has(orderId)) continue;
    const amount = pesos(rec.amount);
    if (amount <= 0) continue;
    newPayments.push({
      tenant_id: tenantId,
      branch_id: branchId,
      order_id: orderId,
      amount_cents: amount,
      payment_method: payMethod(rec.payment_method),
      notes: String(rec.description ?? "").trim() || "Migrado desde Zonat",
      paid_at: rec.payment_date ?? rec.created_at ?? new Date().toISOString(),
      created_by: actorId,
      created_at: rec.created_at ?? rec.payment_date ?? new Date().toISOString(),
    });
  }

  const stockUnits = stockRows.reduce(
    (n, r) => n + Math.max(0, Math.floor(Number(r.quantity ?? 0))),
    0,
  );
  const salesTotal = sales.reduce((n, s) => n + pesos(s.total), 0);
  const pendingCredit = newOrders
    .filter((o) => o.status === "paid")
    .reduce((n, o) => {
      const paid = newPayments
        .filter((p) => p.order_id === o.id)
        .reduce((s, p) => s + p.amount_cents, 0);
      return n + Math.max(0, o.total_cents - paid);
    }, 0);

  const summary = {
    categorias_nuevas: newCats.length,
    productos_nuevos: newProducts.length,
    productos_con_stock: inventoryRows.filter((r) => r.quantity > 0).length,
    unidades_stock: stockUnits,
    clientes_nuevos: newCustomers.length,
    ventas_nuevas: newOrders.length,
    items_venta: newItems.length,
    abonos: newPayments.length,
    ventas_total_cop: salesTotal,
    saldo_credito_cop: pendingCredit,
    zonat: {
      store_stock: stockRows.length,
      products: products.length,
      clients: clients.length,
      sales: sales.length,
      sale_items: saleItems.length,
      payment_records: paymentRecords.length,
    },
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!APPLY) {
    console.log("Dry-run listo. Nada se escribió.");
    return;
  }

  if (newCats.length) await insertChunks(berea, "categories", newCats);
  if (newProducts.length) await insertChunks(berea, "products", newProducts, 40);
  if (inventoryRows.length) await upsertInventory(berea, inventoryRows);
  if (newCustomers.length) await insertChunks(berea, "customers", newCustomers);
  if (newOrders.length) await insertChunks(berea, "orders", newOrders, 40);
  if (newItems.length) await insertChunks(berea, "order_items", newItems, 80);
  if (newPayments.length) await insertChunks(berea, "order_payments", newPayments);

  const { count: productsNow } = await berea
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  const { count: ordersNow } = await berea
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  console.log("Aplicado. Productos", productsNow, "ventas", ordersNow);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
