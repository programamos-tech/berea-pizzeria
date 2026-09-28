import { notFound, redirect } from "next/navigation";
import { OrderCreditPanel } from "@/components/admin/OrderCreditPanel";
import { OrderInvoiceDetailView } from "@/components/admin/OrderInvoiceDetailView";
import type { PedidoLineRecipe } from "@/components/admin/PedidoCocinaPanel";
import { fetchOrderCreditPaymentsMap } from "@/lib/admin-order-credits";
import { fetchAdminRecipeDetail } from "@/lib/admin-menu-catalog";
import { resolveProfileName } from "@/lib/cash-close-report";
import {
  isKitchenStatus,
  type KitchenStatus,
} from "@/lib/kitchen-status";
import {
  isPosCreditSale,
  mapOrderCreditPaymentRows,
  orderCreditPendingCents,
  sumOrderCreditPaidCents,
} from "@/lib/order-credit";
import { parseProcedureSteps } from "@/lib/recipe-procedure-steps";
import { decodeQuotationStockNotices } from "@/lib/quotation-stock-notice";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInvoiceLayoutForRequest, getTenantBrandForRequest } from "@/lib/tenant-context";
import { ventaNumeroReferencia } from "@/lib/ventas-sales";

type ItemRow = {
  id: string;
  quantity: number;
  unit_price_cents: number;
  product_name_snapshot: string;
  product_id: string | null;
  line_discount_percent: number | null;
  line_discount_amount_cents: number | null;
  products:
    | { reference: string | null; recipe_id: string | null }
    | { reference: string | null; recipe_id: string | null }[]
    | null;
};

function productFromRow(row: ItemRow): {
  reference: string | null;
  recipe_id: string | null;
} | null {
  const raw = row.products;
  const p = Array.isArray(raw) ? raw[0] : raw;
  if (!p || typeof p !== "object") return null;
  return p;
}

function productRefFromRow(row: ItemRow): string | null {
  const p = productFromRow(row);
  const ref = p?.reference != null ? String(p.reference).trim() : "";
  return ref.length > 0 ? ref : null;
}

function productRecipeIdFromRow(row: ItemRow): string | null {
  const p = productFromRow(row);
  const id = p?.recipe_id != null ? String(p.recipe_id).trim() : "";
  return id.length > 0 ? id : null;
}

export async function AdminOrderInvoiceScreen({
  orderId,
  searchParams,
  listHref,
  listLabel,
  requireCredit = false,
  creditVariant = "summary",
  canRegisterCredit = false,
  canUseCredit = false,
}: {
  orderId: string;
  searchParams: Record<string, string | string[] | undefined>;
  listHref: string;
  listLabel: string;
  requireCredit?: boolean;
  creditVariant?: "full" | "summary";
  canRegisterCredit?: boolean;
  canUseCredit?: boolean;
}) {
  const supabase = await createSupabaseServerClient();

  const [{ data: order }, { data: itemsRaw }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
    supabase
      .from("order_items")
      .select(
        "id, quantity, unit_price_cents, product_name_snapshot, product_id, line_discount_percent, line_discount_amount_cents, products(reference, recipe_id)",
      )
      .eq("order_id", orderId),
  ]);

  if (!order) notFound();

  const wompiReference =
    order.wompi_reference != null ? String(order.wompi_reference) : null;
  const isPedido = Boolean(wompiReference?.startsWith("POS:pedido:"));
  const isCredit = isPosCreditSale(wompiReference);
  if (requireCredit && !isCredit) {
    redirect(`/admin/orders/${orderId}`);
  }

  const items = (itemsRaw ?? []) as unknown as ItemRow[];

  const lines = items.map((it) => ({
    id: String(it.id),
    name: String(it.product_name_snapshot ?? "Producto"),
    reference: productRefFromRow(it),
    quantity: Number(it.quantity ?? 0),
    unitPriceCents: Number(it.unit_price_cents ?? 0),
    lineDiscountPercent:
      it.line_discount_percent != null && Number(it.line_discount_percent) > 0
        ? Number(it.line_discount_percent)
        : null,
    lineDiscountAmountCents: Math.max(0, Number(it.line_discount_amount_cents ?? 0)),
  }));

  const serviceTypeRaw =
    "service_type" in order && order.service_type != null
      ? String(order.service_type)
      : null;
  const serviceType =
    serviceTypeRaw === "domicilio" || serviceTypeRaw === "en_el_lugar"
      ? serviceTypeRaw
      : null;

  let kitchenStatus: KitchenStatus | null = null;
  if (isPedido) {
    const raw =
      "kitchen_status" in order && order.kitchen_status != null
        ? String(order.kitchen_status)
        : "recibido";
    kitchenStatus = isKitchenStatus(raw) ? raw : "recibido";
  }

  let mesaLabel: string | null = null;
  let lineRecipes: PedidoLineRecipe[] = [];

  if (isPedido) {
    if (serviceType === "en_el_lugar") {
      const { data: sess } = await supabase
        .from("dining_table_sessions")
        .select("dining_table_id, dining_tables(name, code)")
        .eq("order_id", orderId)
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const tables = sess?.dining_tables as
        | { name?: string | null; code?: string | null }
        | { name?: string | null; code?: string | null }[]
        | null
        | undefined;
      const table = Array.isArray(tables) ? tables[0] : tables;
      const code = table?.code != null ? String(table.code).trim() : "";
      const name = table?.name != null ? String(table.name).trim() : "";
      mesaLabel = code || name || null;
    }

    const recipeIds = [
      ...new Set(
        items
          .map((it) => productRecipeIdFromRow(it))
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const recipeMap = new Map<
      string,
      NonNullable<Awaited<ReturnType<typeof fetchAdminRecipeDetail>>>
    >();
    await Promise.all(
      recipeIds.map(async (rid) => {
        const detail = await fetchAdminRecipeDetail(supabase, rid);
        if (detail) recipeMap.set(rid, detail);
      }),
    );

    lineRecipes = items.map((it) => {
      const rid = productRecipeIdFromRow(it);
      const detail = rid ? recipeMap.get(rid) : null;
      return {
        lineId: String(it.id),
        productName: String(it.product_name_snapshot ?? "Producto"),
        recipe: detail
          ? {
              id: String(detail.recipe.id),
              name: String(detail.recipe.name),
              procedureSteps: parseProcedureSteps(
                String(detail.recipe.procedure_text ?? ""),
              ),
              lines: detail.lines.map((l) => ({
                name: String(
                  l.ingredient_name ?? l.component_name ?? "Ítem",
                ),
                quantity: Number(l.quantity ?? 0),
                unit: String(l.unit ?? ""),
                optional: Boolean(l.is_optional),
              })),
            }
          : null,
      };
    });
  }

  const invoiceRef = ventaNumeroReferencia(
    orderId,
    "wompi_transaction_id" in order && order.wompi_transaction_id != null
      ? String(order.wompi_transaction_id)
      : null,
  );

  const customerId =
    order.customer_id != null && String(order.customer_id).trim().length > 0
      ? String(order.customer_id)
      : null;

  const checkoutPm =
    "checkout_payment_method" in order && order.checkout_payment_method != null
      ? String(order.checkout_payment_method)
      : null;

  const needsTransferProofs = checkoutPm === "transfer";

  const [customerRes, proofsRes, saleActorRes, creditPays] = await Promise.all([
    customerId
      ? supabase
          .from("customers")
          .select("phone,document_id,shipping_address,shipping_city")
          .eq("id", customerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    needsTransferProofs
      ? supabase
          .from("order_transfer_proofs")
          .select("storage_path, original_filename, created_at")
          .eq("order_id", orderId)
          .order("created_at", { ascending: true })
      : Promise.resolve({
          data: [] as {
            storage_path: string;
            original_filename: string | null;
            created_at: string;
          }[],
        }),
    supabase
      .from("admin_activity_log")
      .select("actor_id")
      .eq("action_type", "sale_created")
      .eq("entity_type", "order")
      .eq("entity_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    isCredit
      ? fetchOrderCreditPaymentsMap(supabase, [orderId])
      : Promise.resolve(new Map()),
  ]);

  const sellerActorId =
    saleActorRes.data?.actor_id != null
      ? String(saleActorRes.data.actor_id)
      : null;
  const sellerName = sellerActorId
    ? await resolveProfileName(supabase, sellerActorId)
    : null;

  let customerDocumentId: string | null = null;
  let customerPhoneFromProfile: string | null = null;
  let customerAddressFromProfile: string | null = null;

  const cust = customerRes.data;
  if (cust) {
    const doc = cust.document_id != null ? String(cust.document_id).trim() : "";
    if (doc.length > 0) customerDocumentId = doc;
    const phone = cust.phone != null ? String(cust.phone).trim() : "";
    if (phone.length > 0) customerPhoneFromProfile = phone;
    const addrParts = [cust.shipping_city, cust.shipping_address]
      .map((v) => (v != null ? String(v).trim() : ""))
      .filter((v) => v.length > 0);
    if (addrParts.length > 0) customerAddressFromProfile = addrParts.join(" · ");
  }

  const orderShippingPhone =
    order.shipping_phone != null ? String(order.shipping_phone).trim() : "";
  const orderShippingAddress =
    order.shipping_address != null ? String(order.shipping_address).trim() : "";
  const orderShippingCity =
    order.shipping_city != null ? String(order.shipping_city).trim() : "";
  const orderShippingNeighborhood =
    "shipping_neighborhood" in order && order.shipping_neighborhood != null
      ? String(order.shipping_neighborhood).trim()
      : "";
  const orderShippingReference =
    "shipping_reference" in order && order.shipping_reference != null
      ? String(order.shipping_reference).trim()
      : "";
  const orderAddressLine = [
    orderShippingCity,
    orderShippingAddress,
    orderShippingNeighborhood ? `Barrio ${orderShippingNeighborhood}` : "",
    orderShippingReference ? `Ref. ${orderShippingReference}` : "",
  ]
    .filter((v) => v.length > 0)
    .join(" · ");
  const customerAddress =
    orderAddressLine.length > 0 ? orderAddressLine : customerAddressFromProfile;
  const customerPhone =
    orderShippingPhone.length > 0 ? orderShippingPhone : customerPhoneFromProfile;

  let transferProofAttachments: {
    signedUrl: string;
    createdAt: string;
    filename: string | null;
  }[] = [];

  if (needsTransferProofs) {
    const bucket = supabase.storage.from("order-payment-proofs");
    const rows = proofsRes.data ?? [];
    transferProofAttachments = (
      await Promise.all(
        rows.map(async (row) => {
          const path = String(row.storage_path);
          const signed = await bucket.createSignedUrl(path, 3600);
          if (signed.error || !signed.data?.signedUrl) return null;
          return {
            signedUrl: signed.data.signedUrl,
            createdAt: String(row.created_at),
            filename:
              row.original_filename != null ? String(row.original_filename) : null,
          };
        }),
      )
    ).filter((x): x is NonNullable<typeof x> => x != null);
  }

  const [invoiceBrand, invoiceLayout] = await Promise.all([
    getTenantBrandForRequest(),
    getInvoiceLayoutForRequest(),
  ]);

  const payments =
    creditPays.get(orderId) ??
    mapOrderCreditPaymentRows([]);
  const errorRaw = searchParams.error;
  const errorCode = typeof errorRaw === "string" ? errorRaw : null;
  const creditPendingCents = isCredit
    ? orderCreditPendingCents(
        Number(order.total_cents ?? 0),
        sumOrderCreditPaidCents(payments),
      )
    : null;

  return (
    <OrderInvoiceDetailView
      orderId={orderId}
      invoiceRef={invoiceRef}
      status={String(order.status)}
      customerName={String(order.customer_name ?? "")}
      customerEmail={String(order.customer_email ?? "")}
      customerId={customerId}
      sellerName={sellerName}
      totalCents={Number(order.total_cents ?? 0)}
      createdAt={String(order.created_at)}
      wompiReference={wompiReference}
      shippingAddress={
        order.shipping_address != null ? String(order.shipping_address) : null
      }
      shippingCity={
        order.shipping_city != null ? String(order.shipping_city) : null
      }
      shippingNeighborhood={
        orderShippingNeighborhood.length > 0 ? orderShippingNeighborhood : null
      }
      shippingReference={
        orderShippingReference.length > 0 ? orderShippingReference : null
      }
      shippingCents={Number(
        "shipping_cents" in order ? (order.shipping_cents ?? 0) : 0,
      )}
      customerDocumentId={customerDocumentId}
      customerPhone={customerPhone}
      customerAddress={customerAddress}
      shippingPhone={
        order.shipping_phone != null ? String(order.shipping_phone) : null
      }
      cancellationReason={
        order.cancellation_reason != null
          ? String(order.cancellation_reason)
          : null
      }
      lines={lines}
      transferProofAttachments={transferProofAttachments}
      checkoutPaymentMethod={checkoutPm}
      fulfillmentStatus={
        "fulfillment_status" in order && order.fulfillment_status != null
          ? String(order.fulfillment_status)
          : null
      }
      isPedido={isPedido}
      serviceType={serviceType}
      kitchenStatus={kitchenStatus}
      mesaLabel={mesaLabel}
      lineRecipes={lineRecipes}
      ventasListHref={listHref}
      listLabel={isPedido ? "Pedidos" : listLabel}
      invoiceBrand={invoiceBrand}
      invoiceLayout={invoiceLayout}
      convertError={errorCode}
      justInvoiced={searchParams.facturada === "1"}
      stockNotices={decodeQuotationStockNotices(
        typeof searchParams.stock === "string" ? searchParams.stock : undefined,
      )}
      canUseCredit={canUseCredit}
      creditPendingCents={creditPendingCents}
      creditExtras={
        isCredit ? (
          <OrderCreditPanel
            orderId={orderId}
            totalCents={Number(order.total_cents ?? 0)}
            orderStatus={String(order.status)}
            payments={payments}
            canRegister={canRegisterCredit}
            canViewCredits={canUseCredit}
            variant={creditVariant}
            errorCode={errorCode}
          />
        ) : null
      }
    />
  );
}
