import {
  kitIsAvailable,
  maxKitsAvailableFromItems,
  resolveKitSalePriceCents,
  type ProductKitRow,
} from "@/lib/product-kits";
import { fetchKitsByIdsWithItems } from "@/lib/load-product-kits";
import { ventaNumeroReferencia } from "@/lib/ventas-sales";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCurrentBranchInventoryMap } from "@/lib/branch-inventory";

export type QuotationEditDraftLine = {
  productId: string;
  name: string;
  reference: string | null;
  price_cents: number;
  stock_local: number;
  has_vat: boolean;
  vat_percent: number | null;
  quantity: number;
  discountPercent: number | null;
  discountAmountCents: number;
  /** Unitario guardado en la cotización (con IVA si aplica). */
  unitPriceCents: number;
};

export type QuotationEditDraftKitLine = {
  kitId: string;
  name: string;
  price_cents: number;
  max_stock: number;
  available: boolean;
  is_published: boolean;
  item_count: number;
  quantity: number;
};

export type QuotationEditDraft = {
  orderId: string;
  invoiceRef: string;
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    document_id: string | null;
  };
  shippingAddress: string | null;
  lines: QuotationEditDraftLine[];
  kitLines: QuotationEditDraftKitLine[];
};

/**
 * Carga una cotización abierta para reeditarla en el formulario POS.
 * Recalcula stock y precio de catálogo actuales; conserva el unitario cobrado
 * si era mayor al catálogo (campo Cobrar).
 */
export async function loadQuotationEditDraft(
  supabase: SupabaseClient,
  orderId: string,
): Promise<
  | { ok: true; draft: QuotationEditDraft }
  | { ok: false; code: "missing" | "not_quotation" | "no_customer" | "products" }
> {
  const id = orderId.trim();
  if (!id) return { ok: false, code: "missing" };

  const { data: order, error: oErr } = await supabase
    .from("orders")
    .select(
      "id,status,customer_id,customer_name,customer_email,shipping_address,shipping_phone",
    )
    .eq("id", id)
    .maybeSingle();

  if (oErr || !order) return { ok: false, code: "missing" };
  if (String(order.status) !== "quotation") {
    return { ok: false, code: "not_quotation" };
  }

  const customerId =
    order.customer_id != null ? String(order.customer_id).trim() : "";
  if (!customerId) return { ok: false, code: "no_customer" };

  const [{ data: customer }, { data: items }] = await Promise.all([
    supabase
      .from("customers")
      .select("id,name,email,phone,document_id")
      .eq("id", customerId)
      .maybeSingle(),
    supabase
      .from("order_items")
      .select(
        "product_id,kit_id,quantity,unit_price_cents,line_discount_percent,line_discount_amount_cents,product_name_snapshot",
      )
      .eq("order_id", id),
  ]);

  if (!customer?.id) return { ok: false, code: "no_customer" };

  const productIds = [
    ...new Set(
      (items ?? [])
        .map((r) => (r.product_id != null ? String(r.product_id) : ""))
        .filter(Boolean),
    ),
  ];
  const kitIds = [
    ...new Set(
      (items ?? [])
        .map((r) => (r.kit_id != null ? String(r.kit_id) : ""))
        .filter(Boolean),
    ),
  ];

  const [productsRes, kits] = await Promise.all([
    productIds.length > 0
      ? supabase
          .from("products")
          .select(
            "id,name,reference,price_cents,stock_local,has_vat,vat_percent",
          )
          .in("id", productIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    kitIds.length > 0
      ? fetchKitsByIdsWithItems(supabase, kitIds)
      : Promise.resolve([] as ProductKitRow[]),
  ]);

  const productById = new Map(
    (productsRes.data ?? []).map((p) => [String(p.id), p]),
  );
  const inventory = await fetchCurrentBranchInventoryMap(
    supabase,
    productIds,
  );
  const kitById = new Map(kits.map((k) => [String(k.id), k]));

  const lines: QuotationEditDraftLine[] = [];
  const kitLines: QuotationEditDraftKitLine[] = [];

  for (const row of items ?? []) {
    const qty = Math.max(0, Math.floor(Number(row.quantity ?? 0)));
    if (qty <= 0) continue;

    if (row.product_id) {
      const p = productById.get(String(row.product_id));
      if (!p) return { ok: false, code: "products" };
      const pctRaw = row.line_discount_percent;
      const pct =
        pctRaw != null && Number(pctRaw) > 0 && Number(pctRaw) <= 100
          ? Math.floor(Number(pctRaw))
          : null;
      lines.push({
        productId: String(p.id),
        name: String(p.name ?? "Producto"),
        reference:
          p.reference != null && String(p.reference).trim()
            ? String(p.reference).trim()
            : null,
        price_cents: Math.max(0, Math.floor(Number(p.price_cents ?? 0))),
        stock_local: inventory.get(String(p.id)) ?? 0,
        has_vat: Boolean(p.has_vat),
        vat_percent:
          p.vat_percent != null && Number.isFinite(Number(p.vat_percent))
            ? Number(p.vat_percent)
            : null,
        quantity: qty,
        discountPercent: pct,
        discountAmountCents: Math.max(
          0,
          Math.floor(Number(row.line_discount_amount_cents ?? 0)),
        ),
        unitPriceCents: Math.max(
          0,
          Math.floor(Number(row.unit_price_cents ?? 0)),
        ),
      });
      continue;
    }

    if (row.kit_id) {
      const kit = kitById.get(String(row.kit_id));
      if (!kit) return { ok: false, code: "products" };
      const kitItems = kit.items ?? [];
      const maxStock = maxKitsAvailableFromItems(kitItems, "pos");
      kitLines.push({
        kitId: String(kit.id),
        name: String(kit.name ?? "Kit"),
        price_cents: resolveKitSalePriceCents(kit, kitItems, "pos"),
        max_stock: maxStock,
        available: kitIsAvailable(kit, "pos"),
        is_published: Boolean(kit.is_published),
        item_count: kitItems.length,
        quantity: qty,
      });
    }
  }

  if (lines.length === 0 && kitLines.length === 0) {
    return { ok: false, code: "products" };
  }

  return {
    ok: true,
    draft: {
      orderId: id,
      invoiceRef: ventaNumeroReferencia(id),
      customer: {
        id: String(customer.id),
        name: String(customer.name ?? order.customer_name ?? "Cliente"),
        email: customer.email != null ? String(customer.email) : null,
        phone:
          customer.phone != null
            ? String(customer.phone)
            : order.shipping_phone != null
              ? String(order.shipping_phone)
              : null,
        document_id:
          customer.document_id != null ? String(customer.document_id) : null,
      },
      shippingAddress:
        order.shipping_address != null
          ? String(order.shipping_address)
          : null,
      lines,
      kitLines,
    },
  };
}
