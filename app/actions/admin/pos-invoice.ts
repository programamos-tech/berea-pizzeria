"use server";

import {
  accountAllowsCredit,
  accountAllowsKits,
} from "@/lib/admin-account-modules";
import { logAdminActivity } from "@/lib/admin-activity-log";
import {
  activityStockTraceToMetadata,
  buildPosSaleStockTrace,
} from "@/lib/activity-log-stock";
import { claimAdminFormToken } from "@/lib/admin-form-token";
import {
  verifyInsertedRowInDev,
  verifyRowCountAtLeastInDev,
} from "@/lib/admin-insert-verify";
import { requireAdminPermission, assertCashRegisterOpenForStaff } from "@/lib/require-admin-permission";
import { fetchOpenCashSession } from "@/lib/cash-register";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { wholesaleDiscountPercentFromRow } from "@/lib/customer-wholesale-pricing";
import { fetchKitsByIdsWithItems } from "@/lib/load-product-kits";
import {
  buildKitPosComponentDeductions,
  expandKitLinesToProductQty,
  kitIsAvailable,
  maxKitsAvailableFromItems,
  resolveKitSalePriceCents,
  type ProductKitRow,
} from "@/lib/product-kits";
import { computePosProductLineAmounts } from "@/lib/pos-line-price";
import {
  effectiveHasVat,
  posPricePolicyFromConfig,
} from "@/lib/product-vat-price";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fetchCurrentBranchInventoryMap } from "@/lib/branch-inventory";
import { insertOrderCreditPayments } from "@/lib/insert-order-credit-payments";
import {
  isDefaultPosCustomerName,
} from "@/lib/pos-default-customer";
import { POS_CREDIT_REF } from "@/lib/order-credit";

export type PosInvoiceKitLinePayload = {
  kitId: string;
  quantity: number;
};

export type PosInvoiceLinePayload = {
  productId: string;
  quantity: number;
  /** 1–100: descuento % sobre neto de línea (post-mayorista). Si se envía, ignora monto. */
  discountPercent?: number | null;
  /** COP en centavos sobre neto total de línea; solo si no hay % válido. */
  discountAmountCents?: number | null;
  /** Precio cobrado al cliente (con IVA si aplica); `null` = catálogo, `0` = gratis. Sujeto a los flags de la cuenta. */
  chargedUnitCents?: number | null;
};

export type PosServiceType = "domicilio" | "en_el_lugar";

export type PosInvoicePayload = {
  customerId: string;
  lines: PosInvoiceLinePayload[];
  kitLines?: PosInvoiceKitLinePayload[];
  /** venta = cobrada; quotation = cotización; pedido = abierto (sin cobro). */
  documentKind?: "sale" | "quotation" | "pedido";
  /** domicilio | en_el_lugar — requerido para documentKind pedido. */
  serviceType?: PosServiceType | null;
  /** Mesa del salón (requerida si serviceType = en_el_lugar). */
  diningTableId?: string | null;
  /** Nombre del pedido a domicilio (requerido si serviceType = domicilio). */
  guestName?: string | null;
  /** Solicita factura electrónica → cobra IVA en el pedido aunque la cuenta lo tenga apagado. */
  electronicInvoice?: boolean;
  /** Editar cotización existente (solo con documentKind quotation). */
  quotationOrderId?: string | null;
  paymentMethod: "cash" | "transfer" | "mixed" | "credit";
  /** Solo si paymentMethod === "mixed": centavos en efectivo. */
  mixedCashCents?: number;
  /** Solo si paymentMethod === "mixed": centavos en transferencia. */
  mixedTransferCents?: number;
  /** Abono inicial en efectivo si paymentMethod === "credit". */
  creditCashCents?: number;
  /** Abono inicial en transferencia si paymentMethod === "credit". */
  creditTransferCents?: number;
  shippingAddress: string | null;
  shippingPhone: string | null;
  /** Punto de referencia de domicilio (opcional). */
  shippingReference?: string | null;
  /** Token de un solo uso para evitar doble factura por doble clic. */
  submissionId?: string | null;
};

function redirectError(code: string, quotationOrderId?: string): never {
  if (quotationOrderId) {
    redirect(
      `/admin/ventas/nueva?quotation=${encodeURIComponent(quotationOrderId)}&error=${encodeURIComponent(code)}`,
    );
  }
  redirect(`/admin/ventas/nueva?error=${encodeURIComponent(code)}`);
}

function isStockRpcMissingError(err: {
  message?: string;
  code?: string;
  details?: string;
}): boolean {
  const m = `${err.message ?? ""} ${err.details ?? ""}`.toLowerCase();
  return (
    err.code === "42883" ||
    err.code === "PGRST202" ||
    m.includes("decrement_products_stock_local") ||
    m.includes("decrement_order_branch_inventory") ||
    m.includes("could not find the function") ||
    m.includes("schema cache")
  );
}

/** Descuenta stock_local; usa RPC si existe, si no el update secuencial (compatibilidad). */
async function decrementPosStockLocal(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  orderId: string,
  qtyByProduct: Map<string, number>,
  productById: Map<string, { stock_local?: number | null }>,
): Promise<"ok" | "stock" | "db"> {
  const stockItems = [...qtyByProduct.entries()].map(([product_id, quantity]) => ({
    product_id,
    quantity,
  }));

  const { error: stockErr } = await supabase.rpc(
    "decrement_order_branch_inventory",
    {
      p_order_id: orderId,
      p_items: stockItems,
    },
  );

  if (!stockErr) return "ok";

  const stockMsg = `${stockErr.message ?? ""} ${stockErr.details ?? ""}`.toLowerCase();
  if (stockMsg.includes("insufficient_stock")) return "stock";
  if (!isStockRpcMissingError(stockErr)) return "db";

  const stockRollback: { id: string; prev: number }[] = [];
  for (const [pid, qty] of qtyByProduct) {
    const p = productById.get(pid)!;
    const prev = Number(p.stock_local ?? 0);
    const next = Math.max(0, prev - qty);
    const { error: uErr } = await supabase
      .from("products")
      .update({ stock_local: next })
      .eq("id", pid);
    if (uErr) {
      for (const r of stockRollback) {
        await supabase.from("products").update({ stock_local: r.prev }).eq("id", r.id);
      }
      return "db";
    }
    stockRollback.push({ id: pid, prev });
  }
  return "ok";
}

export async function createPosInvoiceAction(formData: FormData) {
  const perm = await requireAdminPermission("ventas_crear");
  const { userId } = perm;
  const supabase = await createSupabaseServerClient();

  let payload: PosInvoicePayload;
  try {
    const raw = String(formData.get("payload") ?? "").trim();
    if (!raw) redirectError("validation");
    payload = JSON.parse(raw) as PosInvoicePayload;
  } catch {
    redirectError("validation");
  }

  const quotationOrderId = String(payload.quotationOrderId ?? "").trim();
  const isEditingQuotation = quotationOrderId.length > 0;
  const documentKind: "sale" | "quotation" | "pedido" = isEditingQuotation
    ? "quotation"
    : payload.documentKind === "quotation"
      ? "quotation"
      : payload.documentKind === "pedido"
        ? "pedido"
        : "sale";
  const isQuotation = documentKind === "quotation";
  const isPedido = documentKind === "pedido";
  /** Pedido abierto o cotización: sin caja ni descuento de stock. */
  const skipsSettlement = isQuotation || isPedido;
  const serviceTypeRaw = String(payload.serviceType ?? "").trim();
  const serviceType: PosServiceType | null =
    serviceTypeRaw === "domicilio" || serviceTypeRaw === "en_el_lugar"
      ? serviceTypeRaw
      : null;
  const diningTableId = String(payload.diningTableId ?? "").trim();

  function redirectFail(code: string): never {
    redirectError(code, isEditingQuotation ? quotationOrderId : undefined);
  }

  const guestName = String(payload.guestName ?? "").trim();
  const electronicInvoice = Boolean(payload.electronicInvoice);

  if (isPedido) {
    if (!serviceType) redirectFail("service_type");
    if (serviceType === "en_el_lugar" && !diningTableId) {
      redirectFail("mesa_required");
    }
    if (serviceType === "domicilio" && guestName.length < 2) {
      redirectFail("guest_name");
    }
  }

  /** Mesa validada antes de crear el pedido (en el lugar). */
  let pedidoDiningTable: { id: string; branch_id: string } | null = null;
  if (isPedido && serviceType === "en_el_lugar" && diningTableId) {
    const { data: table, error: tableErr } = await supabase
      .from("dining_tables")
      .select("id,branch_id,is_active")
      .eq("id", diningTableId)
      .maybeSingle();
    if (tableErr || !table || !table.is_active) redirectFail("mesa_invalid");

    const { data: existingOpen } = await supabase
      .from("dining_table_sessions")
      .select("id")
      .eq("dining_table_id", diningTableId)
      .eq("status", "open")
      .maybeSingle();

    if (existingOpen?.id) redirectFail("mesa_occupied");

    pedidoDiningTable = {
      id: String(table.id),
      branch_id: String(table.branch_id),
    };
  }

  if (
    !skipsSettlement &&
    payload.paymentMethod === "credit" &&
    !accountAllowsCredit(perm.permissions)
  ) {
    redirectFail("credit_forbidden");
  }

  if (isEditingQuotation && !isQuotation) redirectFail("validation");

  const customerId = String(payload.customerId ?? "").trim();
  if (!customerId) redirectFail("validation");

  const linesRaw = Array.isArray(payload.lines) ? payload.lines : [];
  const lines = linesRaw
    .map((row) => {
      const productId = String((row as { productId?: string }).productId ?? "").trim();
      const quantity = Math.floor(Number((row as { quantity?: number }).quantity));
      const pctRaw = (row as { discountPercent?: unknown }).discountPercent;
      const amtRaw = (row as { discountAmountCents?: unknown }).discountAmountCents;
      const pct =
        pctRaw != null && pctRaw !== "" && Number.isFinite(Number(pctRaw))
          ? Math.floor(Number(pctRaw))
          : null;
      const amt = Math.max(0, Math.floor(Number(amtRaw ?? 0)));
      const chargedRaw = (row as { chargedUnitCents?: unknown }).chargedUnitCents;
      const chargedUnitCents =
        chargedRaw != null && chargedRaw !== "" && Number.isFinite(Number(chargedRaw))
          ? Math.floor(Number(chargedRaw))
          : null;
      return {
        productId,
        quantity,
        discountPercent: pct,
        discountAmountCents: amt,
        chargedUnitCents,
      };
    })
    .filter((r) => r.productId && r.quantity > 0);

  const kitLinesRaw = Array.isArray(payload.kitLines) ? payload.kitLines : [];
  const kitLines = kitLinesRaw
    .map((row) => {
      const kitId = String((row as { kitId?: string }).kitId ?? "").trim();
      const quantity = Math.floor(Number((row as { quantity?: number }).quantity));
      return { kitId, quantity };
    })
    .filter((r) => r.kitId && r.quantity > 0);

  if (lines.length === 0 && kitLines.length === 0) redirectFail("validation");
  if (kitLines.length > 0 && !accountAllowsKits(perm.permissions)) {
    redirectFail("kits_forbidden");
  }

  for (const l of lines) {
    if (l.discountPercent != null) {
      if (l.discountPercent < 0 || l.discountPercent > 100) redirectFail("validation");
    }
    if (l.discountAmountCents < 0) redirectFail("validation");
  }

  const paymentMethod = payload.paymentMethod;
  if (
    !skipsSettlement &&
    paymentMethod !== "cash" &&
    paymentMethod !== "transfer" &&
    paymentMethod !== "mixed" &&
    paymentMethod !== "credit"
  ) {
    redirectFail("validation");
  }

  const kitIds = [...new Set(kitLines.map((k) => k.kitId))];

  const [, actorSession, existingQuotationRes, customerRes, kitsLoaded, tenantCfgRes] =
    await Promise.all([
      // Pedido/cotización no exige caja abierta; la venta sí.
      skipsSettlement ? Promise.resolve() : assertCashRegisterOpenForStaff(),
      skipsSettlement ? Promise.resolve(null) : fetchOpenCashSession(supabase),
      isEditingQuotation
        ? supabase
            .from("orders")
            .select("id,status")
            .eq("id", quotationOrderId)
            .maybeSingle()
        : Promise.resolve(null),
      supabase
        .from("customers")
        .select(
          "id,name,email,phone,document_id,shipping_address,customer_kind,wholesale_discount_percent",
        )
        .eq("id", customerId)
        .maybeSingle(),
      kitIds.length > 0
        ? fetchKitsByIdsWithItems(supabase, kitIds)
        : Promise.resolve([] as ProductKitRow[]),
      supabase
        .from("tenants")
        .select("storefront_config")
        .eq("id", perm.tenantId)
        .maybeSingle(),
    ]);
  const cashRegisterSessionId = actorSession?.id ?? null;

  if (existingQuotationRes) {
    const { data: existingQ, error: existingErr } = existingQuotationRes;
    if (existingErr || !existingQ) redirectFail("missing");
    if (String(existingQ!.status) !== "quotation") redirectFail("not_quotation");
  }

  const { data: customer, error: cErr } = customerRes;
  if (cErr || !customer) redirectFail("customer");
  const customerRow = customer;
  if (
    !skipsSettlement &&
    paymentMethod === "credit" &&
    isDefaultPosCustomerName(String(customerRow.name ?? ""))
  ) {
    redirectFail("credit_customer");
  }
  const wholesalePct = wholesaleDiscountPercentFromRow(
    customerRow as {
      customer_kind?: string | null;
      wholesale_discount_percent?: number | null;
    },
  );

  const kitsById = new Map<string, ProductKitRow>();
  for (const kit of kitsLoaded) {
    kitsById.set(kit.id, kit);
  }
  if (kitIds.length > 0) {
    if (kitsById.size !== kitIds.length) redirectFail("products");
    for (const kl of kitLines) {
      const kit = kitsById.get(kl.kitId)!;
      if (!skipsSettlement) {
        if (!kitIsAvailable(kit, "pos")) redirectFail("stock");
        const maxK = maxKitsAvailableFromItems(kit.items ?? [], "pos");
        if (maxK < kl.quantity) redirectFail("stock");
      }
    }
  }

  const qtyByProduct = new Map<string, number>();
  for (const l of lines) {
    qtyByProduct.set(l.productId, (qtyByProduct.get(l.productId) ?? 0) + l.quantity);
  }
  const kitQtyExpanded = expandKitLinesToProductQty(kitLines, kitsById);
  for (const [pid, qty] of kitQtyExpanded) {
    qtyByProduct.set(pid, (qtyByProduct.get(pid) ?? 0) + qty);
  }

  const lineProductIds = [...new Set(lines.map((l) => l.productId))];
  const stockProductIds = [...qtyByProduct.keys()];
  const productById = new Map<
    string,
    {
      id: string;
      name: string;
      price_cents: number;
      stock_local: number | null;
      stock_warehouse: number | null;
      has_vat: boolean | null;
      vat_percent: number | null;
    }
  >();

  if (stockProductIds.length > 0) {
    const [{ data: products, error: pErr }, inventory] = await Promise.all([
      supabase
        .from("products")
        .select(
          "id,name,price_cents,stock_local,stock_warehouse,has_vat,vat_percent",
        )
        .in("id", stockProductIds),
      fetchCurrentBranchInventoryMap(supabase, stockProductIds),
    ]);

    if (pErr || !products) redirectFail("products");
    for (const p of products) {
      productById.set(p.id as string, {
        ...p,
        stock_local: inventory.get(String(p.id)) ?? 0,
      });
    }
    for (const [pid, qty] of qtyByProduct) {
      const p = productById.get(pid);
      if (!p) redirectFail("products");
      if (!skipsSettlement) {
        const stock = Number(p.stock_local ?? 0);
        if (stock < qty) redirectFail("stock");
      }
    }
    for (const pid of lineProductIds) {
      if (!productById.has(pid)) redirectFail("products");
    }
  }

  const storefrontConfig = tenantCfgRes.data?.storefront_config;
  const pricePolicy = posPricePolicyFromConfig(storefrontConfig);

  function saleLineAmounts(
    p: {
      price_cents: number;
      has_vat: boolean | null;
    },
    quantity: number,
    chargedUnitCents: number | null,
    discountPercent: number | null,
    discountAmountCents: number,
  ): { lineNetAfter: number; unitFinal: number } {
    const hasVat =
      isPedido && electronicInvoice
        ? true
        : effectiveHasVat(storefrontConfig, p.has_vat);
    const priced = computePosProductLineAmounts({
      priceCatalog: Math.max(0, Math.floor(Number(p.price_cents ?? 0))),
      hasVat,
      wholesalePct,
      quantity,
      chargedUnitCents,
      discountPercent,
      discountAmountCents,
      policy: pricePolicy,
    });
    if (priced.discountInvalid) redirectFail("validation");
    if (priced.violatesPolicy) redirectFail("price_floor");
    return { lineNetAfter: priced.lineNetAfter, unitFinal: priced.unitFinal };
  }

  let subtotalCents = 0;
  let vatCents = 0;
  let totalCents = 0;
  for (const l of lines) {
    const p = productById.get(l.productId);
    if (!p) redirectFail("products");
    const priced = saleLineAmounts(
      p,
      l.quantity,
      l.chargedUnitCents,
      l.discountPercent,
      l.discountAmountCents,
    );
    subtotalCents += priced.lineNetAfter;
    totalCents += priced.unitFinal * l.quantity;
  }

  for (const kl of kitLines) {
    const kit = kitsById.get(kl.kitId)!;
    const items = kit.items ?? [];
    const unitKit = resolveKitSalePriceCents(kit, items, "pos");
    const lineGross = unitKit * kl.quantity;
    subtotalCents += lineGross;
    totalCents += lineGross;
  }
  vatCents = Math.max(0, totalCents - subtotalCents);

  if (!Number.isFinite(totalCents) || totalCents < 0) redirectFail("validation");

  const submissionId = String(payload.submissionId ?? "").trim();
  const claim = await claimAdminFormToken(
    supabase,
    submissionId,
    isEditingQuotation
      ? `pos_quotation_edit:${quotationOrderId}`
      : `pos_invoice:${documentKind}:${customerId}`,
  );
  if (claim === "duplicate") {
    revalidatePath("/admin/ventas");
    if (isEditingQuotation) {
      redirect(`/admin/orders/${quotationOrderId}`);
    }
    redirect("/admin/ventas");
  }
  if (claim === "error") {
    redirectFail("validation");
  }

  const emailRaw =
    customerRow.email != null ? String(customerRow.email).trim() : "";
  const customerEmail =
    emailRaw.length > 0 ? emailRaw.toLowerCase() : `pos-${customerId.slice(0, 8)}@local.invalid`;

  const shippingAddress =
    payload.shippingAddress != null && String(payload.shippingAddress).trim().length > 0
      ? String(payload.shippingAddress).trim()
      : null;

  const shippingPhone =
    payload.shippingPhone != null && String(payload.shippingPhone).trim().length > 0
      ? String(payload.shippingPhone).trim()
      : customerRow.phone != null
        ? String(customerRow.phone).trim() || null
        : null;

  const shippingReference =
    payload.shippingReference != null &&
    String(payload.shippingReference).trim().length > 0
      ? String(payload.shippingReference).trim()
      : null;

  const wompiRef = isPedido
    ? `POS:pedido:${serviceType}`
    : isQuotation
      ? "POS:quotation"
      : paymentMethod === "credit"
        ? POS_CREDIT_REF
        : `POS:${paymentMethod}`;

  let posMixedCashCents: number | null = null;
  let posMixedTransferCents: number | null = null;
  if (!skipsSettlement && paymentMethod === "mixed") {
    const cash = Math.floor(Number(payload.mixedCashCents ?? 0));
    const transfer = Math.floor(Number(payload.mixedTransferCents ?? 0));
    if (
      cash < 0 ||
      transfer < 0 ||
      !Number.isFinite(cash) ||
      !Number.isFinite(transfer) ||
      cash + transfer !== totalCents
    ) {
      redirectFail("validation");
    }
    posMixedCashCents = cash;
    posMixedTransferCents = transfer;
  }

  let creditCashCents = 0;
  let creditTransferCents = 0;
  if (!skipsSettlement && paymentMethod === "credit") {
    creditCashCents = Math.max(0, Math.floor(Number(payload.creditCashCents ?? 0)));
    creditTransferCents = Math.max(
      0,
      Math.floor(Number(payload.creditTransferCents ?? 0)),
    );
    const down = creditCashCents + creditTransferCents;
    if (down >= totalCents) redirectFail("credit_full");
  }

  let orderId: string;

  if (isEditingQuotation) {
    const { data: updatedOrder, error: updErr } = await supabase
      .from("orders")
      .update({
        customer_name: String(customerRow.name ?? "Cliente"),
        customer_email: customerEmail,
        customer_id: customerId,
        total_cents: totalCents,
        currency: "COP",
        wompi_reference: "POS:quotation",
        shipping_address: shippingAddress,
        shipping_phone: shippingPhone,
        shipping_reference: shippingReference,
        pos_mixed_cash_cents: null,
        pos_mixed_transfer_cents: null,
        status: "quotation",
      })
      .eq("id", quotationOrderId)
      .eq("status", "quotation")
      .select("id")
      .maybeSingle();

    if (updErr || !updatedOrder?.id) redirectFail("db");
    orderId = String(updatedOrder!.id);

    const { error: delItemsErr } = await supabase
      .from("order_items")
      .delete()
      .eq("order_id", orderId);
    if (delItemsErr) redirectFail("db");
  } else {
    const displayCustomerName =
      isPedido && serviceType === "domicilio" && guestName.length >= 2
        ? guestName
        : String(customerRow.name ?? "Cliente");

    const { data: orderRow, error: oErr } = await supabase
      .from("orders")
      .insert({
        status: isPedido ? "pending" : isQuotation ? "quotation" : "paid",
        customer_name: displayCustomerName,
        customer_email: customerEmail,
        customer_id: customerId,
        total_cents: totalCents,
        currency: "COP",
        wompi_reference: isPedido
          ? `${wompiRef}${electronicInvoice ? ":fe" : ""}`
          : wompiRef,
        shipping_address: shippingAddress,
        shipping_phone: shippingPhone,
        shipping_reference: shippingReference,
        ...(serviceType ? { service_type: serviceType } : {}),
        ...(!skipsSettlement && paymentMethod === "mixed"
          ? {
              pos_mixed_cash_cents: posMixedCashCents,
              pos_mixed_transfer_cents: posMixedTransferCents,
            }
          : {}),
        ...(!skipsSettlement && cashRegisterSessionId
          ? { cash_register_session_id: cashRegisterSessionId }
          : {}),
      })
      .select("id")
      .single();

    if (oErr || !orderRow?.id) {
      redirectFail("db");
    }

    orderId = String(orderRow!.id);
  }

  if (isPedido && serviceType === "en_el_lugar" && pedidoDiningTable) {
    const { data: existingOpen } = await supabase
      .from("dining_table_sessions")
      .select("id")
      .eq("dining_table_id", pedidoDiningTable.id)
      .eq("status", "open")
      .maybeSingle();

    if (existingOpen?.id) {
      await supabase.from("orders").delete().eq("id", orderId);
      redirectFail("mesa_occupied");
    }

    const { error: sessErr } = await supabase
      .from("dining_table_sessions")
      .insert({
        dining_table_id: pedidoDiningTable.id,
        branch_id: pedidoDiningTable.branch_id,
        status: "open",
        order_id: orderId,
        note: "Pedido en el lugar",
      });
    if (sessErr) {
      await supabase.from("orders").delete().eq("id", orderId);
      redirectFail("db");
    }
  }

  const productItemRows = lines.map((l) => {
    const p = productById.get(l.productId)!;
    const pctForCalc =
      l.discountPercent != null && l.discountPercent > 0 && l.discountPercent <= 100
        ? l.discountPercent
        : null;
    const amtForCalc = pctForCalc != null ? 0 : l.discountAmountCents;
    const priced = saleLineAmounts(
      p,
      l.quantity,
      l.chargedUnitCents,
      l.discountPercent,
      l.discountAmountCents,
    );
    return {
      order_id: orderId,
      product_id: l.productId,
      kit_id: null,
      quantity: l.quantity,
      unit_price_cents: priced.unitFinal,
      product_name_snapshot: String(p.name ?? "Producto"),
      line_discount_percent: pctForCalc,
      line_discount_amount_cents: pctForCalc != null ? 0 : amtForCalc,
      stock_deducted_local: skipsSettlement ? 0 : l.quantity,
      stock_deducted_warehouse: 0,
      kit_component_deductions: null,
    };
  });

  const kitItemRows = kitLines.map((kl) => {
    const kit = kitsById.get(kl.kitId)!;
    const items = kit.items ?? [];
    const unitKit = resolveKitSalePriceCents(kit, items, "pos");
    const deductions = skipsSettlement
      ? null
      : buildKitPosComponentDeductions(kit, kl.quantity);
    return {
      order_id: orderId,
      product_id: null,
      kit_id: kl.kitId,
      quantity: kl.quantity,
      unit_price_cents: unitKit,
      product_name_snapshot: `Kit: ${kit.name}`,
      line_discount_percent: null,
      line_discount_amount_cents: 0,
      stock_deducted_local: 0,
      stock_deducted_warehouse: 0,
      kit_component_deductions: deductions,
    };
  });

  const itemRows = [...productItemRows, ...kitItemRows];

  const { error: iErr } = await supabase.from("order_items").insert(itemRows);

  if (iErr) {
    if (!isEditingQuotation) {
      await supabase.from("orders").delete().eq("id", orderId);
    }
    redirectFail("db");
  }

  if (!isEditingQuotation) {
    const [orderVerified, itemsVerified] = await Promise.all([
      verifyInsertedRowInDev(supabase, "orders", orderId),
      verifyRowCountAtLeastInDev(
        supabase,
        "order_items",
        { column: "order_id", value: orderId },
        itemRows.length,
      ),
    ]);

    if (!orderVerified) {
      await supabase.from("orders").delete().eq("id", orderId);
      redirectFail("db");
    }
    if (!itemsVerified) {
      await supabase.from("order_items").delete().eq("order_id", orderId);
      await supabase.from("orders").delete().eq("id", orderId);
      redirectFail("db");
    }
  } else {
    const itemsVerified = await verifyRowCountAtLeastInDev(
      supabase,
      "order_items",
      { column: "order_id", value: orderId },
      itemRows.length,
    );
    if (!itemsVerified) redirectFail("db");
  }

  const stockProductById = new Map(
    [...productById.entries()].map(([id, p]) => [id, { stock_local: p.stock_local }]),
  );

  const stockByProductId = new Map(
    [...productById.entries()].map(([id, p]) => [
      id,
      {
        id,
        name: String(p.name ?? "Producto"),
        stock_local: p.stock_local,
        stock_warehouse: p.stock_warehouse,
      },
    ]),
  );

  const stockTrace = buildPosSaleStockTrace({
    productLines: lines.map((l) => ({
      productId: l.productId,
      name: String(productById.get(l.productId)?.name ?? "Producto"),
      quantity: l.quantity,
    })),
    kitLines: kitLines.map((kl) => {
      const kit = kitsById.get(kl.kitId)!;
      const productNames = new Map(
        (kit.items ?? []).map((row) => [
          String(row.product_id),
          String(row.products?.name ?? "Producto"),
        ]),
      );
      return {
        kitName: String(kit.name ?? "Kit"),
        deductions: skipsSettlement
          ? []
          : buildKitPosComponentDeductions(kit, kl.quantity),
        productNames,
      };
    }),
    stockByProductId,
  });

  if (!skipsSettlement) {
    const stockResult = await decrementPosStockLocal(
      supabase,
      orderId,
      qtyByProduct,
      stockProductById,
    );
    if (stockResult !== "ok") {
      await supabase.from("orders").delete().eq("id", orderId);
      redirectFail(stockResult === "stock" ? "stock" : "db");
    }
  }

  if (!skipsSettlement && paymentMethod === "credit") {
    const payRows = [
      ...(creditCashCents > 0
        ? [{ amountCents: creditCashCents, paymentMethod: "cash" as const }]
        : []),
      ...(creditTransferCents > 0
        ? [{ amountCents: creditTransferCents, paymentMethod: "transfer" as const }]
        : []),
    ];
    if (payRows.length > 0) {
      const payResult = await insertOrderCreditPayments(supabase, {
        orderId,
        createdBy: userId,
        payments: payRows,
        cashRegisterSessionId,
      });
      if (payResult !== "ok") redirectFail("db");
    }
  }

  const totalFormatted = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(totalCents);

  void logAdminActivity(supabase, {
    actorId: userId,
    actionType: "sale_created",
    entityType: "order",
    entityId: orderId,
    summary: isEditingQuotation
      ? `Cotización actualizada · ${String(customerRow.name ?? "Cliente")} · ${totalFormatted}`
      : isPedido
        ? `Pedido (${serviceType === "en_el_lugar" ? "en el lugar" : "domicilio"}) · ${String(customerRow.name ?? "Cliente")} · ${totalFormatted}`
        : isQuotation
          ? `Cotización a ${String(customerRow.name ?? "Cliente")} · ${totalFormatted}`
          : `Venta a ${String(customerRow.name ?? "Cliente")} · ${totalFormatted}`,
    metadata: {
      customer_id: customerId,
      document_kind: documentKind,
      service_type: serviceType,
      dining_table_id: diningTableId || null,
      guest_name: guestName || null,
      electronic_invoice: isPedido ? electronicInvoice : null,
      edited_quotation: isEditingQuotation,
      subtotal_cents: subtotalCents,
      vat_cents: vatCents,
      total_cents: totalCents,
      payment_method: skipsSettlement ? null : paymentMethod,
      ...(paymentMethod === "mixed" && posMixedCashCents != null
        ? {
            mixed_cash_cents: posMixedCashCents,
            mixed_transfer_cents: posMixedTransferCents,
          }
        : {}),
      ...(paymentMethod === "credit"
        ? {
            credit_cash_cents: creditCashCents,
            credit_transfer_cents: creditTransferCents,
          }
        : {}),
      line_items: lines.length,
      kit_lines: kitLines.length,
      submission_id: submissionId || null,
      ...(skipsSettlement ? {} : activityStockTraceToMetadata(stockTrace)),
    },
  });
  revalidatePath("/admin/ventas");
  revalidatePath("/admin");
  revalidatePath("/admin/creditos");
  revalidatePath("/admin/caja");
  revalidatePath(`/admin/orders/${orderId}`);
  if (!skipsSettlement && paymentMethod === "credit") {
    revalidatePath(`/admin/creditos/${orderId}`);
  }
  redirect(
    !skipsSettlement && paymentMethod === "credit"
      ? `/admin/creditos/${orderId}`
      : `/admin/orders/${orderId}${isEditingQuotation ? "?updated=1" : ""}`,
  );
}
