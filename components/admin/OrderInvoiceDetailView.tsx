import Link from "next/link";
import type { ReactNode } from "react";
import { Armchair, Bike } from "lucide-react";
import {
  OrderInvoicePrintButton,
  OrderInvoiceStatusSelect,
} from "@/components/admin/OrderInvoiceHeaderControls";
import { OrderQuotationActions } from "@/components/admin/OrderQuotationActions";
import { OrderInvoiceFulfillmentSelect } from "@/components/admin/OrderInvoiceFulfillmentSelect";
import {
  PedidoCocinaPanel,
  type PedidoLineRecipe,
} from "@/components/admin/PedidoCocinaPanel";
import { StaticCopCents } from "@/components/admin/ReportsAnimatedFigures";
import type { KitchenStatus } from "@/lib/kitchen-status";
import {
  adminProductBrand,
  adminSidebarLogoPath,
  invoiceLegalName as envInvoiceLegalName,
  invoiceLogoPath as envInvoiceLogoPath,
  invoiceStoreAddress as envInvoiceStoreAddress,
  invoiceStoreCity as envInvoiceStoreCity,
  invoiceTaxNit as envInvoiceTaxNit,
  invoiceTradeName as envInvoiceTradeName,
  storeSupportEmail as envStoreSupportEmail,
  storeSupportHours as envStoreSupportHours,
  storeSupportPhone as envStoreSupportPhone,
  storeTaxRegime as envStoreTaxRegime,
} from "@/lib/brand";
import type { InvoiceLayout } from "@/lib/invoice-layout";
import { formatCop } from "@/lib/money";
import {
  quotationConvertErrorMessage,
  type QuotationStockNotice,
} from "@/lib/quotation-stock-notice";
import { getPublicSiteUrl } from "@/lib/public-site-url";
import {
  formatStoreInvoiceDateNumeric,
  formatStoreInvoiceDateTime,
} from "@/lib/store-datetime-format";
import type { InvoiceBrandFields } from "@/lib/tenant-brand";
import {
  ventaFormaPagoTone,
  ventaPagoRecibidoTone,
} from "@/lib/ventas-sales";

function stockNoticeLine(row: QuotationStockNotice): string {
  const covered = row.tookLocal + row.tookWarehouse;
  const short = Math.max(0, row.need - covered);
  const parts = [
    `pedía ${row.need}`,
    `había ${row.hadLocal} en local`,
    `y ${row.hadWarehouse} en bodega`,
  ];
  if (row.tookWarehouse > 0) {
    parts.push(`se descontó ${row.tookLocal} local y ${row.tookWarehouse} bodega`);
  } else {
    parts.push(`se descontó ${row.tookLocal}`);
  }
  if (short > 0) parts.push(`faltaron ${short} (stock quedó en 0)`);
  return `${row.name}: ${parts.join(", ")}.`;
}

const labelClass =
  "text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500";

const metaIconClass = "size-4 shrink-0 text-zinc-400 dark:text-zinc-500";
const metaSepClass = "text-zinc-300 dark:text-zinc-600";
const metaTextClass = "text-zinc-700 dark:text-zinc-300";

type Line = {
  id: string;
  name: string;
  reference: string | null;
  quantity: number;
  unitPriceCents: number;
  lineDiscountPercent: number | null;
  lineDiscountAmountCents: number;
};

function lineDiscountColumn(line: Line): string | null {
  if (line.lineDiscountPercent != null && line.lineDiscountPercent > 0) {
    return `${line.lineDiscountPercent}%`;
  }
  if (line.lineDiscountAmountCents > 0) {
    return formatCop(line.lineDiscountAmountCents);
  }
  return null;
}

export type OrderInvoiceDetailViewProps = {
  orderId: string;
  invoiceRef: string;
  status: string;
  customerName: string;
  customerEmail: string;
  /** Perfil del cliente en admin, si existe (enlace al detalle). */
  customerId?: string | null;
  /** Quién registró la venta en mostrador (si hay log). */
  sellerName?: string | null;
  /** Cédula / documento del cliente (perfil), si existe. */
  customerDocumentId?: string | null;
  /** Teléfono: pedido o perfil del cliente. */
  customerPhone?: string | null;
  /** Dirección: envío del pedido o perfil del cliente. */
  customerAddress?: string | null;
  totalCents: number;
  createdAt: string;
  wompiReference: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingNeighborhood?: string | null;
  shippingReference?: string | null;
  shippingPhone: string | null;
  /** Costo de envío cobrado (0 = gratis o no aplica). */
  shippingCents?: number;
  /** Motivo registrado al anular desde el panel. */
  cancellationReason: string | null;
  lines: Line[];
  transferProofAttachments?: {
    signedUrl: string;
    createdAt: string;
    filename: string | null;
  }[];
  checkoutPaymentMethod?: string | null;
  fulfillmentStatus?: string | null;
  /** Pedido POS de salón/domicilio (cocina). */
  isPedido?: boolean;
  serviceType?: "domicilio" | "en_el_lugar" | null;
  kitchenStatus?: KitchenStatus | null;
  kitchenCompletedAt?: string | null;
  mesaLabel?: string | null;
  lineRecipes?: PedidoLineRecipe[];
  /** Enlace al listado Ventas (p. ej. misma página y filtros). */
  ventasListHref?: string;
  /** Texto del listado en el breadcrumb. */
  listLabel?: string;
  /** Bloque extra (crédito: saldo, abonos). */
  creditExtras?: React.ReactNode;
  /** Saldo pendiente de factura a crédito (para Estado del pago). */
  creditPendingCents?: number | null;
  /** Marca de tirilla/factura (tenant brand → env fallback). */
  invoiceBrand?: InvoiceBrandFields;
  convertError?: string | null;
  justInvoiced?: boolean;
  stockNotices?: QuotationStockNotice[];
  /** Formato de factura: tira (default) u hoja carta. Las cotizaciones siempre van en hoja. */
  invoiceLayout?: InvoiceLayout;
  canUseCredit?: boolean;
};

function IconClock({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l3.5 2" />
    </svg>
  );
}

function IconUser({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconBuilding({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12h12" />
      <path d="M6 16h12" />
      <path d="M10 6h4" />
      <path d="M10 22v-4h4v4" />
    </svg>
  );
}

function IconSeller({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function formatInvoiceDate(iso: string): string {
  return formatStoreInvoiceDateTime(iso);
}

function formatInvoiceDateShort(iso: string): string {
  return formatStoreInvoiceDateNumeric(iso);
}

export function OrderInvoiceDetailView(props: OrderInvoiceDetailViewProps) {
  const {
    orderId,
    invoiceRef,
    status,
    customerName,
    customerEmail,
    customerId = null,
    sellerName = null,
    customerDocumentId = null,
    customerPhone = null,
    customerAddress = null,
    totalCents,
    createdAt,
    wompiReference,
    shippingAddress,
    shippingCity,
    shippingNeighborhood,
    shippingReference,
    shippingPhone,
    shippingCents = 0,
    cancellationReason,
    lines,
    transferProofAttachments = [],
    checkoutPaymentMethod = null,
    fulfillmentStatus = null,
    isPedido = false,
    serviceType = null,
    kitchenStatus = null,
    kitchenCompletedAt = null,
    mesaLabel = null,
    lineRecipes = [],
    ventasListHref = "/admin/ventas",
    listLabel = "Ventas",
    creditExtras,
    creditPendingCents = null,
    invoiceBrand,
    convertError = null,
    justInvoiced = false,
    stockNotices = [],
    invoiceLayout = "ticket",
    canUseCredit = true,
  } = props;

  const invoiceTradeName =
    invoiceBrand?.invoiceTradeName ?? envInvoiceTradeName;
  const invoiceLegalName =
    invoiceBrand?.invoiceLegalName ?? envInvoiceLegalName;
  const invoiceTaxNit = invoiceBrand?.invoiceTaxNit ?? envInvoiceTaxNit;
  const storeTaxRegime = invoiceBrand?.storeTaxRegime ?? envStoreTaxRegime;
  const invoiceStoreAddress =
    invoiceBrand?.invoiceStoreAddress ?? envInvoiceStoreAddress;
  const invoiceStoreCity =
    invoiceBrand?.invoiceStoreCity ?? envInvoiceStoreCity;
  const invoiceLogoPath =
    invoiceBrand?.invoiceLogoSrc ??
    invoiceBrand?.invoiceLogoPath ??
    envInvoiceLogoPath;
  const storeSupportPhone =
    invoiceBrand?.storeSupportPhone ?? envStoreSupportPhone;
  const storeSupportEmail =
    invoiceBrand?.storeSupportEmail ?? envStoreSupportEmail;
  const storeSupportHours =
    invoiceBrand?.storeSupportHours ?? envStoreSupportHours;

  const isTransferWeb = checkoutPaymentMethod === "transfer";
  const isQuotation = status === "quotation";
  const isLetterLayout = isQuotation || invoiceLayout === "letter";
  const docNoun = isPedido
    ? "Pedido"
    : isQuotation
      ? "Cotización"
      : "Factura";

  const pagoTone = ventaFormaPagoTone(wompiReference, {
    checkoutPaymentMethod: checkoutPaymentMethod ?? undefined,
  });
  const pagoRecibido = ventaPagoRecibidoTone(
    status,
    wompiReference,
    creditPendingCents ?? undefined,
  );

  const subtotalLines = lines.reduce(
    (s, l) => s + l.unitPriceCents * l.quantity,
    0,
  );
  const expectedTotal = subtotalLines + Math.max(0, shippingCents);
  const totalsMatch = expectedTotal === totalCents;
  const showShippingRow =
    shippingCents > 0 ||
    (Boolean(shippingCity?.trim()) && checkoutPaymentMethod === "transfer");

  const hasShipping =
    Boolean(shippingAddress?.trim()) || Boolean(shippingCity?.trim());
  const ubicacionLine = hasShipping
    ? [
        shippingCity,
        shippingAddress,
        shippingNeighborhood?.trim()
          ? `Barrio ${shippingNeighborhood.trim()}`
          : null,
        shippingReference?.trim()
          ? `Ref. ${shippingReference.trim()}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Retiro en tienda";

  const printDocumentId = customerDocumentId?.trim() || null;
  const printPhone = (customerPhone ?? shippingPhone)?.trim() || null;
  const printAddress = customerAddress?.trim() || null;
  const showDirMeta =
    hasShipping &&
    Boolean(printAddress) &&
    printAddress!.toLowerCase() !== ubicacionLine.toLowerCase();
  const customerHref = customerId
    ? `/admin/customers/${customerId}`
    : null;
  const isPosSale = Boolean(wompiReference?.trim().startsWith("POS:"));
  const sellerLabel =
    sellerName?.trim() ||
    (isPosSale ? null : "En línea");
  const siteUrl = getPublicSiteUrl().replace(/^https?:\/\//, "");
  const contactEmail = storeSupportEmail;

  const th =
    "pb-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500";

  const showTransferProofs =
    (status === "pending" || status === "paid") &&
    checkoutPaymentMethod === "transfer" &&
    transferProofAttachments.length > 0;

  const convertErrorMessage = quotationConvertErrorMessage(
    convertError ?? undefined,
  );

  return (
    <div
      className={
        isLetterLayout
          ? "quotation-letterhead-print flex w-full min-w-0 max-w-none flex-col gap-4 print:mx-auto print:max-w-none print:gap-0 print:bg-white print:px-0 print:py-0 print:text-zinc-900 dark:print:bg-white"
          : "invoice-ticket-print flex w-full min-w-0 max-w-none flex-col gap-4 print:mx-auto print:max-w-[72mm] print:gap-2 print:bg-white print:px-0 print:py-0 print:text-zinc-900 print:leading-snug dark:print:bg-white"
      }
    >
      {convertErrorMessage ? (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 print:hidden dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
          role="alert"
        >
          {convertErrorMessage}
        </div>
      ) : null}
      {justInvoiced ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm print:hidden ${
            stockNotices.length > 0
              ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-100"
              : "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-100"
          }`}
          role="status"
        >
          <p className="font-medium">
            {stockNotices.length > 0
              ? "Cotización facturada. El stock de local no alcanzaba; se actualizó con lo que había (local y bodega)."
              : "Cotización facturada. Se descontó el stock y quedó como venta pagada."}
          </p>
          {stockNotices.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {stockNotices.map((row, i) => (
                <li key={`${row.name}-${i}`}>{stockNoticeLine(row)}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <header className="print:hidden">
        <div className="min-w-0">
          <p className="text-[11px] text-zinc-500">
            <Link
              href={ventasListHref}
              className="hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              {listLabel}
            </Link>
            <span className="mx-1.5 text-zinc-400">/</span>
            {docNoun} #{invoiceRef}
          </p>
          <div className="mt-0.5 flex items-center justify-between gap-3">
            <h1 className="min-w-0 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-2xl">
              {docNoun} #{invoiceRef}
            </h1>
            <div className="flex shrink-0 items-center gap-2">
              {isPedido ? (
                serviceType === "domicilio" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--admin-coral)] px-3 py-1.5 text-sm font-bold tracking-wide text-white shadow-sm">
                    <Bike
                      className="size-4 shrink-0"
                      strokeWidth={2.4}
                      aria-hidden
                    />
                    Domicilio
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-bold tracking-wide text-white shadow-sm dark:bg-teal-600">
                    <Armchair
                      className="size-4 shrink-0"
                      strokeWidth={2.4}
                      aria-hidden
                    />
                    {mesaLabel ? `Mesa ${mesaLabel}` : "En el lugar"}
                  </span>
                )
              ) : null}
              <Link
                href={ventasListHref}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                title="Volver"
                aria-label={isPedido ? "Volver a pedidos" : "Volver a ventas"}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="size-4"
                  aria-hidden
                >
                  <path
                    d="m15 18-6-6 6-6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </div>
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <IconClock className={metaIconClass} />
              <span className={`tabular-nums ${metaTextClass}`}>
                {formatInvoiceDate(createdAt)}
              </span>
            </span>
            <span className={metaSepClass} aria-hidden>
              ·
            </span>
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <IconUser className={metaIconClass} />
              {customerHref ? (
                <Link
                  href={customerHref}
                  className="min-w-0 truncate font-medium text-zinc-800 underline-offset-2 transition hover:text-zinc-950 hover:underline dark:text-zinc-200 dark:hover:text-white"
                >
                  {customerName}
                </Link>
              ) : (
                <span className={`min-w-0 truncate font-medium ${metaTextClass}`}>
                  {customerName}
                </span>
              )}
            </span>
            <span className={metaSepClass} aria-hidden>
              ·
            </span>
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <IconBuilding className={metaIconClass} />
              <span className={`min-w-0 truncate ${metaTextClass}`}>
                {ubicacionLine}
              </span>
            </span>
            {sellerLabel ? (
              <>
                <span className={metaSepClass} aria-hidden>
                  ·
                </span>
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <IconSeller className={metaIconClass} />
                  <span className={`min-w-0 truncate ${metaTextClass}`}>
                    <span className="text-zinc-500">Vendió </span>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">
                      {sellerLabel}
                    </span>
                  </span>
                </span>
              </>
            ) : null}
            {printDocumentId ? (
              <>
                <span className={metaSepClass} aria-hidden>
                  ·
                </span>
                <span>
                  Cédula{" "}
                  <span className="font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
                    {printDocumentId}
                  </span>
                </span>
              </>
            ) : null}
            {printPhone ? (
              <>
                <span className={metaSepClass} aria-hidden>
                  ·
                </span>
                <span>
                  Tel.{" "}
                  <span className="font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
                    {printPhone}
                  </span>
                </span>
              </>
            ) : null}
            {showDirMeta ? (
              <>
                <span className={metaSepClass} aria-hidden>
                  ·
                </span>
                <span className="min-w-0 break-words">
                  Dir.{" "}
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {printAddress}
                  </span>
                </span>
              </>
            ) : null}
          </p>
          {status === "cancelled" && cancellationReason?.trim() ? (
            <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
              <span className="font-medium">Anulación: </span>
              {cancellationReason.trim()}
            </p>
          ) : null}
        </div>
      </header>

      {isLetterLayout ? (
        <div className="hidden print:block print:text-[10.5pt] print:leading-snug print:text-zinc-900">
          <div className="print:flex print:items-start print:justify-between print:gap-8 print:pb-2">
            <div className="print:min-w-0 print:flex-1">
              <p className="print:text-[16pt] print:font-semibold print:leading-tight print:tracking-tight print:text-black">
                {invoiceLegalName}
              </p>
              <p className="print:mt-1 print:text-[9pt] print:text-zinc-600">
                {[
                  invoiceTradeName.trim() &&
                  !invoiceLegalName
                    .toLowerCase()
                    .includes(invoiceTradeName.trim().toLowerCase())
                    ? invoiceTradeName
                    : null,
                  `NIT ${invoiceTaxNit}`,
                  storeTaxRegime,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="print:mt-1 print:text-[8.5pt] print:text-zinc-500">
                {storeSupportPhone} · {contactEmail} · {siteUrl}
              </p>
              {(invoiceStoreAddress || invoiceStoreCity || storeSupportHours) && (
                <p className="print:mt-0.5 print:text-[8.5pt] print:text-zinc-500">
                  {[
                    [invoiceStoreAddress, invoiceStoreCity]
                      .filter(Boolean)
                      .join(" · "),
                    storeSupportHours,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
            <div className="print:size-[16mm] print:shrink-0 print:overflow-hidden print:rounded-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={invoiceLogoPath}
                alt={invoiceTradeName}
                className="print:size-full print:object-cover"
              />
            </div>
          </div>

          <div className="print:mt-6 print:flex print:items-end print:justify-between print:gap-4">
            <div>
              <p className="print:text-[8pt] print:font-semibold print:uppercase print:tracking-[0.14em] print:text-zinc-500">
                {docNoun}
              </p>
              <p className="print:mt-1 print:text-[20pt] print:font-semibold print:leading-none print:tracking-tight print:text-black">
                #{invoiceRef}
              </p>
            </div>
            <p className="print:text-right print:text-[10pt] print:tabular-nums print:text-zinc-600">
              {formatInvoiceDateShort(createdAt)}
            </p>
          </div>

          <div className="print:mt-6 print:py-1">
            <p className="print:text-[8pt] print:font-bold print:uppercase print:tracking-[0.12em] print:text-zinc-500">
              Cliente
            </p>
            <p className="print:mt-0.5 print:text-[11pt] print:font-semibold print:text-zinc-950">
              {customerName}
            </p>
            <div className="print:mt-1 print:space-y-0.5 print:text-[9.5pt] print:text-zinc-700">
              {printDocumentId ? <p>Documento: {printDocumentId}</p> : null}
              {printPhone ? <p>Teléfono: {printPhone}</p> : null}
              {customerEmail && !customerEmail.includes("@local.invalid") ? (
                <p>Correo: {customerEmail}</p>
              ) : null}
              {printAddress ? <p>Dirección: {printAddress}</p> : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden print:block print:text-[10px] print:leading-snug print:text-black">
          <div className="print:flex print:flex-col print:items-center print:pb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={invoiceLogoPath}
              alt={invoiceTradeName}
              className="print:mb-2 print:h-11 print:w-auto print:max-w-[58mm] print:object-contain"
            />
            <p className="print:text-center print:text-[12px] print:font-bold print:leading-tight">
              {invoiceLegalName}
            </p>
            <p className="print:mt-0.5 print:text-center print:text-[10px] print:font-semibold">
              NIT: {invoiceTaxNit} — {storeTaxRegime}
            </p>
            {invoiceStoreAddress ? (
              <p className="print:mt-1 print:text-center print:text-[10px]">
                {invoiceStoreAddress}
              </p>
            ) : null}
            {invoiceStoreCity ? (
              <p className="print:text-center print:text-[10px] print:font-semibold">
                {invoiceStoreCity}
              </p>
            ) : null}
            <p className="print:mt-1 print:text-center print:text-[10px] print:font-semibold">
              TEL: {storeSupportPhone}
            </p>
            <p className="print:mt-2 print:text-center print:text-[10px] print:font-bold">
              {docNoun} #{invoiceRef}
            </p>
            <p className="print:text-center print:text-[10px] print:tabular-nums">
              {formatInvoiceDateShort(createdAt)}
            </p>
          </div>

          <div className="print:my-2 print:border-t print:border-dashed print:border-black" />

          <div className="print:space-y-1 print:px-0.5">
            <p>
              <span className="font-bold">Cliente:</span> {customerName}
            </p>
            {printDocumentId ? (
              <p>
                <span className="font-bold">Cédula:</span> {printDocumentId}
              </p>
            ) : null}
            {printPhone ? (
              <p>
                <span className="font-bold">Teléfono:</span> {printPhone}
              </p>
            ) : null}
            {printAddress ? (
              <p className="print:break-words">
                <span className="font-bold">Dirección:</span> {printAddress}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {/* Pantalla: layout limpio estilo Reportes (impresión arriba en bloques hidden print:block) */}
      <div className="print:hidden">
        {isPedido && kitchenStatus ? (
          <div className="mb-5">
            <PedidoCocinaPanel
              orderId={orderId}
              createdAt={createdAt}
              initialKitchenStatus={kitchenStatus}
              initialKitchenCompletedAt={kitchenCompletedAt}
              serviceType={serviceType}
              lineRecipes={lineRecipes}
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-6 border-t border-zinc-200/70 pt-4 dark:border-zinc-800 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(18rem,20rem)] lg:items-start lg:gap-10 xl:gap-12">
          <section className="reports-chart-reveal min-w-0">
            {lines.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No hay ítems en este pedido.
              </p>
            ) : (
              <div className="max-h-[min(56dvh,32rem)] overflow-x-auto overflow-y-auto lg:max-h-[calc(100dvh-13rem)]">
                <table className="w-full min-w-[40rem] table-fixed text-left text-sm leading-relaxed sm:text-[15px]">
                  <colgroup>
                    <col className="w-auto" />
                    <col className="w-14" />
                    <col className="w-[7.5rem]" />
                    <col className="w-[6.5rem]" />
                    <col className="w-[9.5rem]" />
                  </colgroup>
                  <thead className="sticky top-0 z-[1] bg-white dark:bg-zinc-950">
                    <tr className="border-b border-zinc-200/70 dark:border-zinc-800">
                      <th className={th}>Producto</th>
                      <th className={`${th} text-right`}>Ud</th>
                      <th className={`${th} text-right`}>P. unit.</th>
                      <th className={`${th} text-right`}>Descuento</th>
                      <th className={`${th} !pr-6 text-right sm:!pr-8`}>
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => {
                      const sub = line.unitPriceCents * line.quantity;
                      const ref = line.reference?.trim();
                      const disc = lineDiscountColumn(line);
                      return (
                        <tr
                          key={line.id}
                          className="border-b border-zinc-100/80 last:border-0 dark:border-zinc-800/80"
                        >
                          <td className="py-3 pr-5 align-middle text-zinc-800 dark:text-zinc-200">
                            <span className="block font-medium leading-snug">
                              {line.name}
                            </span>
                            {ref ? (
                              <span className="mt-1 block font-mono text-xs text-zinc-500">
                                Ref. {ref}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                            {line.quantity}
                          </td>
                          <td className="whitespace-nowrap py-3 pr-4 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                            {formatCop(line.unitPriceCents)}
                          </td>
                          <td
                            className={`whitespace-nowrap py-3 pr-4 text-right tabular-nums ${
                              disc
                                ? "text-zinc-700 dark:text-zinc-300"
                                : "text-zinc-400 dark:text-zinc-600"
                            }`}
                          >
                            {disc ?? "—"}
                          </td>
                          <td className="whitespace-nowrap py-3 pl-3 pr-6 text-right tabular-nums text-base font-semibold text-zinc-900 dark:text-zinc-100 sm:pr-8">
                            {formatCop(sub)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <aside className="reports-chart-reveal shrink-0 space-y-5 border-t border-zinc-200/70 pt-4 dark:border-zinc-800 lg:sticky lg:top-3 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0 xl:pl-10 dark:lg:border-zinc-800">
            {showShippingRow ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-zinc-500">Subtotal</span>
                  <span className="tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                    <StaticCopCents cents={subtotalLines} />
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-zinc-500">
                    Envío
                    {shippingCity?.trim() ? ` · ${shippingCity.trim()}` : ""}
                  </span>
                  <span className="tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                    {shippingCents > 0 ? (
                      <StaticCopCents cents={shippingCents} />
                    ) : (
                      "Gratis"
                    )}
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-t border-zinc-200/70 pt-3 dark:border-zinc-800">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Total
                  </span>
                  <span className="text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
                    <StaticCopCents cents={totalCents} />
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <p className={labelClass}>Total</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
                  <StaticCopCents cents={totalCents} />
                </p>
              </div>
            )}

            <div>
              <p className={labelClass}>Método de pago</p>
              <p className={`mt-1.5 text-sm ${pagoTone.className}`}>{pagoTone.label}</p>
            </div>
            {creditExtras ? null : (
            <div>
              <p className={labelClass}>Estado del pago</p>
              <p className={`mt-1.5 text-sm ${pagoRecibido.className}`}>
                {pagoRecibido.label}
              </p>
            </div>
            )}

            <div>
              <p className={labelClass}>Impresión</p>
              <div className="mt-1.5">
                {isQuotation ? (
                  <OrderQuotationActions
                    orderId={orderId}
                    invoiceRef={invoiceRef}
                    customerEmail={customerEmail}
                    customerName={customerName}
                    totalCents={totalCents}
                    canUseCredit={canUseCredit}
                  />
                ) : (
                  <OrderInvoicePrintButton />
                )}
              </div>
            </div>
            <div>
              <p className={labelClass}>
                {isQuotation ? "Estado del documento" : "Estado de la factura"}
              </p>
              <div className="mt-1.5">
                <OrderInvoiceStatusSelect
                  orderId={orderId}
                  invoiceRef={invoiceRef}
                  currentStatus={status}
                />
              </div>
            </div>
            {isTransferWeb && status !== "cancelled" ? (
              <div>
                <p className={labelClass}>Estado del envío</p>
                <div className="mt-1.5">
                  <OrderInvoiceFulfillmentSelect
                    orderId={orderId}
                    currentStatus={fulfillmentStatus}
                  />
                </div>
              </div>
            ) : null}

            {showTransferProofs ? (
              <div>
                <p className={labelClass}>Comprobantes</p>
                <ul className="mt-1.5 space-y-1">
                  {transferProofAttachments.map((att, idx) => {
                    const label =
                      att.filename?.trim() ||
                      `Archivo ${idx + 1}`;
                    return (
                      <li key={`${att.createdAt}-${idx}`}>
                        <a
                          href={att.signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-xs font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
                        >
                          {label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      </div>

      {creditExtras ? (
        <div className="print:hidden">{creditExtras}</div>
      ) : null}

      {/* PRINT-ONLY: tablas + totales (pantalla ya tiene layout compacto arriba) */}
      <div className="hidden print:block">
        {lines.length === 0 ? null : (
          <>
            {isLetterLayout ? (
              <table className="ql-table w-full border-collapse text-[10pt] text-zinc-900">
                <thead>
                  <tr className="border-b border-zinc-300">
                    <th className="py-2 pr-2 text-left text-[8pt] font-bold uppercase tracking-[0.1em]">
                      Cant.
                    </th>
                    <th className="py-2 pr-2 text-left text-[8pt] font-bold uppercase tracking-[0.1em]">
                      Descripción
                    </th>
                    <th className="w-[22mm] py-2 pr-2 text-right text-[8pt] font-bold uppercase tracking-[0.1em]">
                      V. unit.
                    </th>
                    <th className="w-[26mm] py-2 text-right text-[8pt] font-bold uppercase tracking-[0.1em]">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const sub = line.unitPriceCents * line.quantity;
                    const ref = line.reference?.trim();
                    return (
                      <tr key={`print-${line.id}`} className="align-top">
                        <td className="border-b border-zinc-100 py-2 pr-2 tabular-nums font-semibold">
                          {line.quantity}
                        </td>
                        <td className="border-b border-zinc-100 py-2 pr-2">
                          <span className="block break-words font-medium leading-snug">
                            {line.name}
                          </span>
                          {ref ? (
                            <span className="mt-0.5 block font-mono text-[8pt] text-zinc-500">
                              Ref. {ref}
                            </span>
                          ) : null}
                        </td>
                        <td className="border-b border-zinc-100 py-2 pr-2 text-right tabular-nums">
                          {formatCop(line.unitPriceCents)}
                        </td>
                        <td className="border-b border-zinc-100 py-2 text-right tabular-nums font-semibold">
                          {formatCop(sub)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full border-collapse text-[10px] text-black">
                <thead>
                  <tr className="border-b-2 border-black">
                    <th className="w-8 py-1 text-left font-bold">Cant.</th>
                    <th className="py-1 text-left font-bold">Artículo</th>
                    <th className="w-[4.5rem] py-1 text-right font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const sub = line.unitPriceCents * line.quantity;
                    const ref = line.reference?.trim();
                    return (
                      <tr
                        key={`print-${line.id}`}
                        className="border-b border-dashed border-zinc-500 align-top"
                      >
                        <td className="py-1.5 tabular-nums font-semibold">
                          {line.quantity}
                        </td>
                        <td className="py-1.5 pr-1">
                          <span className="block break-words font-medium leading-snug">
                            {line.name}
                          </span>
                          {ref ? (
                            <span className="block font-mono text-[9px] text-zinc-800">
                              Ref. {ref}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-1.5 text-right tabular-nums font-bold">
                          {formatCop(sub)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            <div className="mt-4 flex justify-end print:break-inside-avoid">
              <div
                className={
                  isLetterLayout
                    ? "w-full max-w-[70mm] border-t border-zinc-200 pt-3"
                    : "w-full max-w-none"
                }
              >
                {totalsMatch && !showShippingRow ? (
                  <div
                    className={
                      isLetterLayout
                        ? "flex justify-between gap-4 text-[11pt]"
                        : "flex justify-between gap-4 border-t-2 border-black pt-2"
                    }
                  >
                    <span
                      className={
                        isLetterLayout
                          ? "font-semibold uppercase tracking-[0.12em] text-[8pt] text-zinc-500"
                          : "font-bold text-[12px] text-black"
                      }
                    >
                      TOTAL
                    </span>
                    <span
                      className={
                        isLetterLayout
                          ? "text-[13pt] font-bold tabular-nums text-zinc-950"
                          : "text-[13px] font-bold tabular-nums text-black"
                      }
                    >
                      {formatCop(totalCents)}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between gap-4 text-[11px]">
                      <span className="font-semibold text-black">
                        Subtotal productos
                      </span>
                      <span className="font-bold tabular-nums text-black">
                        {formatCop(subtotalLines)}
                      </span>
                    </div>
                    {showShippingRow ? (
                      <div className="mt-2 flex justify-between gap-4 text-[11px]">
                        <span className="font-semibold text-black">
                          Envío
                          {shippingCity?.trim()
                            ? ` · ${shippingCity.trim()}`
                            : ""}
                        </span>
                        <span className="font-bold tabular-nums text-black">
                          {shippingCents > 0 ? formatCop(shippingCents) : "Gratis"}
                        </span>
                      </div>
                    ) : null}
                    <div className="mt-3 flex justify-between gap-4 border-t-2 border-black pt-3">
                      <span className="font-bold text-[11px] text-black">
                        {isQuotation ? "Total cotizado" : "Total a pagar"}
                      </span>
                      <span className="text-base font-bold tabular-nums text-black">
                        {formatCop(totalCents)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {isLetterLayout ? (
        <>
        <div className="ql-footer hidden print:mt-8 print:block print:pb-[18mm] print:text-center print:text-[8.5pt] print:leading-relaxed print:text-zinc-500">
          <p>
            {isQuotation
              ? "Esta cotización está sujeta a disponibilidad de inventario, vigencia de precios y confirmación al momento de facturar. No constituye factura. IVA incluido."
              : "Documento de venta. IVA incluido. Gracias por su compra."}
          </p>
        </div>
        <div className="ql-powered hidden print:fixed print:bottom-[10mm] print:left-0 print:right-0 print:flex print:flex-col print:items-center print:gap-1">
          <span className="print:text-[6.5pt] print:font-medium print:uppercase print:tracking-[0.14em] print:text-zinc-400">
            Powered by
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={adminSidebarLogoPath}
            alt={adminProductBrand}
            className="print:h-[5mm] print:w-auto print:max-w-[30mm] print:object-contain"
          />
        </div>
        </>
      ) : (
        <div className="hidden print:mt-4 print:block print:text-black">
          <p className="border-t border-dashed border-zinc-600 pt-8 text-center text-[10px]">
            Firma cliente
          </p>
          <p className="mt-3 text-center text-[10px] font-semibold leading-snug">
            {lines.length} producto{lines.length === 1 ? "" : "s"} · IVA incluido
          </p>
          <p className="mt-1 text-center text-[11px] font-bold">
            ¡Gracias por su compra! · {invoiceTradeName}
          </p>
        </div>
      )}
    </div>
  );
}
