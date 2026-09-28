"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { createQuickStoreCustomer } from "@/app/actions/admin/store-customers";
import { AdminFormSubmitButton } from "@/components/admin/AdminFormSubmitButton";
import { AdminPortalRoot } from "@/components/admin/AdminPortalRoot";
import { createPosInvoiceAction } from "@/app/actions/admin/pos-invoice";
import { adminCreateFailedMessage } from "@/lib/admin-create-failed-messages";
import {
  productInputClass as inputClass,
  productLabelClass as labelClass,
  productSectionTitle as sectionTitle,
} from "@/components/admin/product-form-primitives";
import { adminButtonCancelClass } from "@/lib/admin-ui";
import {
  formatCop,
  formatCopInputGrouping,
  parseCopChargedPesos,
  parseCopChargedPesosOrNull,
  parseCopInputDigitsToInt,
  sanitizeCopIntegerTyping,
} from "@/lib/money";
import { isDefaultPosCustomerName } from "@/lib/pos-default-customer";
import {
  parseStoreCustomerKind,
  unitPriceAfterWholesaleCents,
  wholesaleDiscountPercentFromRow,
} from "@/lib/customer-wholesale-pricing";
import {
  ADMIN_SEARCH_TIMEOUT_MS,
  abortSignalWithTimeout,
} from "@/lib/abort-signal-timeout";
import type { QuotationEditDraft } from "@/lib/load-quotation-edit-draft";
import {
  saleVatPercentLabel,
  unitPriceGrossCents,
  type PosPricePolicy,
} from "@/lib/product-vat-price";
import {
  computePosProductLineAmounts,
  POS_PRICE_NOT_ALLOWED_MESSAGE,
} from "@/lib/pos-line-price";

const sectionClass =
  "border-t border-zinc-200/70 pt-4 dark:border-zinc-800";

const btnIdle =
  "inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800";

const segmentTrackClass =
  "mt-3 flex gap-1 rounded-lg border border-zinc-200/80 bg-zinc-50/80 p-1 dark:border-zinc-800 dark:bg-zinc-900/50";

const segmentBtnActive =
  "border border-zinc-300 bg-white text-zinc-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:shadow-none";

const segmentBtnIdle =
  "text-zinc-600 hover:bg-white/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-950/70 dark:hover:text-zinc-100";

type ProductHit = {
  id: string;
  name: string;
  reference: string | null;
  price_cents: number;
  stock_quantity?: number | null;
  stock_local?: number | null;
  has_vat?: boolean | null;
  vat_percent?: number | null;
};

export type DiningTableOption = {
  id: string;
  name: string;
  code: string;
  seats: number;
  occupied: boolean;
};

export type PosServiceType = "domicilio" | "en_el_lugar";

type KitHit = {
  id: string;
  name: string;
  price_cents: number;
  max_stock: number;
  available: boolean;
  is_published: boolean;
  item_count: number;
};

type KitCartLine = {
  key: string;
  kit: KitHit;
  quantity: number;
};

type CustomerHit = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  document_id: string | null;
};

type ShipOption =
  | { kind: "pickup"; id: "pickup"; label: string; detail: string }
  | { kind: "address"; id: string; label: string; detail: string };

const PICKUP_SHIP_OPTION: Extract<ShipOption, { kind: "pickup" }> = {
  kind: "pickup",
  id: "pickup",
  label: "Retiro en tienda",
  detail: "El cliente recoge en sucursal.",
};

type LineDiscountMode = "none" | "percent" | "amount";

type CartLine = {
  key: string;
  product: ProductHit;
  quantity: number;
  discountMode: LineDiscountMode;
  discountPercent: number;
  /** Dígitos COP (como efectivo) para descuento fijo sobre neto de línea. */
  discountAmountRaw: string;
  /** Precio cobrado al cliente (con IVA si aplica). Vacío = catálogo. */
  chargedGrossRaw: string;
};

function productChargesVat(product: ProductHit, chargeVat: boolean): boolean {
  return chargeVat && Boolean(product.has_vat);
}

function unitFinalCents(
  product: ProductHit,
  wholesalePct: number,
  chargeVat: boolean,
): number {
  const net = unitPriceAfterWholesaleCents(
    Number(product.price_cents ?? 0),
    wholesalePct,
  );
  return unitPriceGrossCents(
    net,
    productChargesVat(product, chargeVat),
    product.vat_percent,
  );
}

const LIST_PRICE_ONLY_POLICY: PosPricePolicy = {
  allowHigher: false,
  allowBelow: false,
};

function catalogLineNetCents(line: CartLine, wholesalePct: number): number {
  return (
    unitPriceAfterWholesaleCents(Number(line.product.price_cents ?? 0), wholesalePct) *
    line.quantity
  );
}

/** Cobrar vacío o igual al de lista → `null` (precio de catálogo). */
function lineChargedUnitCents(
  line: CartLine,
  wholesalePct: number,
  chargeVat: boolean,
): number | null {
  const typed = parseCopChargedPesosOrNull(line.chargedGrossRaw);
  if (typed == null) return null;
  return typed === unitFinalCents(line.product, wholesalePct, chargeVat)
    ? null
    : typed;
}

function effectiveLineDiscountPercent(line: CartLine): number | null {
  if (line.discountMode !== "percent") return null;
  const p = Math.floor(line.discountPercent);
  return p > 0 && p <= 100 ? p : null;
}

function linePricing(
  line: CartLine,
  wholesalePct: number,
  policy: PosPricePolicy,
  chargeVat: boolean,
  discount?: { percent: number | null; amountCents: number },
) {
  return computePosProductLineAmounts({
    priceCatalog: Number(line.product.price_cents ?? 0),
    hasVat: productChargesVat(line.product, chargeVat),
    wholesalePct,
    quantity: line.quantity,
    chargedUnitCents: lineChargedUnitCents(line, wholesalePct, chargeVat),
    discountPercent: discount ? discount.percent : effectiveLineDiscountPercent(line),
    discountAmountCents: discount
      ? discount.amountCents
      : effectiveLineDiscountAmountCents(line, wholesalePct, policy, chargeVat),
    policy,
  });
}

function lineNetBeforeDiscount(
  line: CartLine,
  wholesalePct: number,
  policy: PosPricePolicy,
  chargeVat: boolean,
): number {
  return linePricing(line, wholesalePct, policy, chargeVat, {
    percent: null,
    amountCents: 0,
  }).lineNetBefore;
}

function effectiveLineDiscountAmountCents(
  line: CartLine,
  wholesalePct: number,
  policy: PosPricePolicy,
  chargeVat: boolean,
): number {
  if (line.discountMode !== "amount") return 0;
  const raw = parseCopInputDigitsToInt(line.discountAmountRaw);
  const maxNet = lineNetBeforeDiscount(line, wholesalePct, policy, chargeVat);
  return Math.min(Math.max(0, raw), maxNet);
}

type PaymentTab = "cash" | "transfer" | "mixed" | "credit";

function IconCoin() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8M9.5 10h5M9.5 14h5" strokeLinecap="round" />
    </svg>
  );
}

function IconCard() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </svg>
  );
}

function IconNotebook() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M6 4h12v16H6z" />
      <path d="M9 8h6M9 12h6M9 16h4" strokeLinecap="round" />
    </svg>
  );
}

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z" />
    </svg>
  );
}

function IconTrash({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

const removeLineBtnClass =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40";

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function NewInvoiceHeader({
  editQuotation,
}: {
  editQuotation?: QuotationEditDraft;
}) {
  const editing = Boolean(editQuotation);
  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-2 gap-y-2">
      <div className="min-w-0">
        <p className="text-[11px] text-zinc-500">
          <Link
            href="/admin/ventas"
            className="hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Pedidos
          </Link>
          <span className="mx-1.5 text-zinc-400">/</span>
          {editing && editQuotation ? (
            <>
              <Link
                href={`/admin/orders/${editQuotation.orderId}`}
                className="hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                Cotización #{editQuotation.invoiceRef}
              </Link>
              <span className="mx-1.5 text-zinc-400">/</span>
              Editar
            </>
          ) : (
            "Nuevo pedido"
          )}
        </p>
        <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-2xl">
          {editing && editQuotation
            ? `Editar cotización #${editQuotation.invoiceRef}`
            : "Nuevo pedido"}
        </h1>
        {editing ? (
          <p className="mt-1 text-sm text-zinc-500">
            Modificá cliente, productos o cantidades y guardá.
          </p>
        ) : null}
      </div>
      <Link
        href={
          editing && editQuotation
            ? `/admin/orders/${editQuotation.orderId}`
            : "/admin/ventas"
        }
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
        title={editing ? "Volver a la cotización" : "Volver a pedidos"}
        aria-label={editing ? "Volver a la cotización" : "Volver a pedidos"}
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
    </header>
  );
}

function errorMessage(code: string | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case "validation":
      return "Revisa cliente, productos y cantidades.";
    case "customer":
      return "No se encontró el cliente.";
    case "products":
      return "Algún producto no es válido o ya no existe.";
    case "stock":
      return "Stock insuficiente en tienda para uno o más productos.";
    case "not_quotation":
      return "Esa cotización ya no se puede editar (fue facturada o anulada).";
    case "missing":
      return "No se encontró la cotización.";
    case "credit_customer":
      return "Las facturas a crédito requieren un cliente nominado. No uses Cliente Final.";
    case "credit_full":
      return "Si el abono cubre el total, usa Efectivo, Transferencia o Mixto.";
    case "kits_forbidden":
      return "Kits está apagado en Configuración. Quitá los combos de la factura.";
    case "price_floor":
      return POS_PRICE_NOT_ALLOWED_MESSAGE;
    case "service_type":
      return "Elegí si el pedido es domicilio o en el lugar.";
    case "mesa_required":
      return "Para un pedido en el lugar, asigná una mesa.";
    case "mesa_occupied":
      return "Esa mesa ya tiene un pedido abierto. Elegí otra o cerrá el actual.";
    case "mesa_invalid":
      return "La mesa seleccionada no es válida.";
    case "db":
      return adminCreateFailedMessage("sale");
    default:
      return "Ocurrió un error al confirmar el pedido.";
  }
}

function ConfirmInvoiceButton({
  disabled,
  documentKind,
  editingQuotation,
}: {
  disabled: boolean;
  documentKind: "sale" | "quotation" | "pedido";
  editingQuotation?: boolean;
}) {
  return (
    <AdminFormSubmitButton
      pendingLabel="Guardando…"
      disabled={disabled}
      data-invoice-confirm="true"
      className="mt-4 w-full rounded-lg border border-[var(--admin-coral)] bg-[var(--admin-coral)] py-2.5 text-sm font-semibold text-white transition hover:border-[var(--admin-coral-hover)] hover:bg-[var(--admin-coral-hover)] disabled:cursor-not-allowed disabled:opacity-45"
    >
      {editingQuotation
        ? "Guardar cambios"
        : documentKind === "quotation"
          ? "Guardar cotización"
          : documentKind === "pedido"
            ? "Crear pedido"
            : "Confirmar factura"}
    </AdminFormSubmitButton>
  );
}

function onInvoiceFormSubmit(
  e: React.FormEvent<HTMLFormElement>,
  payloadJson: string,
) {
  const submitter = (e.nativeEvent as SubmitEvent).submitter;
  if (
    !(submitter instanceof HTMLButtonElement) ||
    submitter.dataset.invoiceConfirm !== "true"
  ) {
    e.preventDefault();
    return;
  }
  const payloadInput = e.currentTarget.elements.namedItem("payload");
  if (payloadInput instanceof HTMLInputElement) {
    payloadInput.value = payloadJson;
  }
}

export function NewInvoiceForm({
  initialError,
  initialCustomerId,
  editQuotation,
  canUseCredit = true,
  canUseKits = true,
  pricePolicy = LIST_PRICE_ONLY_POLICY,
  chargeVat = true,
  diningTables = [],
}: {
  initialError?: string;
  initialCustomerId?: string;
  editQuotation?: QuotationEditDraft;
  canUseCredit?: boolean;
  canUseKits?: boolean;
  pricePolicy?: PosPricePolicy;
  chargeVat?: boolean;
  diningTables?: DiningTableOption[];
}) {
  const canEditLinePrice = pricePolicy.allowHigher || pricePolicy.allowBelow;
  const editingQuotation = Boolean(editQuotation);
  const quickNameInputRef = useRef<HTMLInputElement>(null);
  const customerSearchInputRef = useRef<HTMLInputElement>(null);
  const [quickModalOpen, setQuickModalOpen] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickDocument, setQuickDocument] = useState("");
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickPending, setQuickPending] = useState(false);

  const [productQuery, setProductQuery] = useState("");
  const debouncedProductQ = useDebounced(productQuery, 280);
  const [productHits, setProductHits] = useState<ProductHit[]>([]);
  const [productLoading, setProductLoading] = useState(false);

  const [kitQuery, setKitQuery] = useState("");
  const debouncedKitQ = useDebounced(kitQuery, 280);
  const [kitHits, setKitHits] = useState<KitHit[]>([]);
  const [kitLoading, setKitLoading] = useState(false);

  const [customerQuery, setCustomerQuery] = useState("");
  const debouncedCustomerQ = useDebounced(customerQuery, 280);
  const [customerHits, setCustomerHits] = useState<CustomerHit[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState<string | null>(
    null,
  );

  const [customer, setCustomer] = useState<CustomerHit | null>(() =>
    editQuotation
      ? {
          id: editQuotation.customer.id,
          name: editQuotation.customer.name,
          email: editQuotation.customer.email,
          phone: editQuotation.customer.phone,
          document_id: editQuotation.customer.document_id,
        }
      : null,
  );
  const [customerWholesalePct, setCustomerWholesalePct] = useState(0);
  const [posCustomerKind, setPosCustomerKind] = useState<"retail" | "wholesale">("retail");
  const [shipOptions, setShipOptions] = useState<ShipOption[]>([]);
  const [shipChoice, setShipChoice] = useState<string | null>(null);
  const [shipLoading, setShipLoading] = useState(false);
  const [submissionId] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `pos_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`,
  );
  /** Evita un segundo fetch de pos-profile cuando ya aplicamos el perfil (p. ej. ?customer=). */
  const profileAppliedForIdRef = useRef<string | null>(null);
  const shipLoadGenRef = useRef(0);
  const editShipHydratedRef = useRef(false);

  const [lines, setLines] = useState<CartLine[]>(() =>
    (editQuotation?.lines ?? []).map((l) => {
      const hasPct = l.discountPercent != null && l.discountPercent > 0;
      const hasAmt = !hasPct && l.discountAmountCents > 0;
      const catalogGross = unitPriceGrossCents(
        unitPriceAfterWholesaleCents(l.price_cents, 0),
        l.has_vat,
        l.vat_percent,
      );
      const savedUnit = Math.max(0, Math.floor(Number(l.unitPriceCents ?? 0)));
      const chargedGrossRaw =
        !hasPct && !hasAmt && savedUnit !== catalogGross
          ? sanitizeCopIntegerTyping(String(savedUnit))
          : "";
      return {
        key: crypto.randomUUID(),
        product: {
          id: l.productId,
          name: l.name,
          reference: l.reference,
          price_cents: l.price_cents,
          stock_local: l.stock_local,
          stock_quantity: l.stock_local,
          has_vat: l.has_vat,
          vat_percent: l.vat_percent,
        },
        quantity: l.quantity,
        discountMode: hasPct ? "percent" : hasAmt ? "amount" : "none",
        discountPercent: hasPct ? l.discountPercent! : 0,
        discountAmountRaw: hasAmt ? String(l.discountAmountCents) : "",
        chargedGrossRaw,
      };
    }),
  );
  const [kitLines, setKitLines] = useState<KitCartLine[]>(() =>
    (editQuotation?.kitLines ?? []).map((k) => ({
      key: crypto.randomUUID(),
      kit: {
        id: k.kitId,
        name: k.name,
        price_cents: k.price_cents,
        max_stock: k.max_stock,
        available: k.available,
        is_published: k.is_published,
        item_count: k.item_count,
      },
      quantity: k.quantity,
    })),
  );
  const [payment, setPayment] = useState<PaymentTab>("cash");
  const [documentKind, setDocumentKind] = useState<
    "sale" | "quotation" | "pedido"
  >(editingQuotation ? "quotation" : "pedido");
  const [serviceType, setServiceType] = useState<PosServiceType>("en_el_lugar");
  const [diningTableId, setDiningTableId] = useState<string>(() => {
    const firstFree = diningTables.find((t) => !t.occupied);
    return firstFree?.id ?? "";
  });
  const skipsStockGate =
    documentKind === "quotation" || documentKind === "pedido";
  const availableTables = useMemo(
    () => diningTables.filter((t) => !t.occupied),
    [diningTables],
  );

  useEffect(() => {
    if (!canUseCredit && payment === "credit") setPayment("cash");
  }, [canUseCredit, payment]);
  const [cashGivenRaw, setCashGivenRaw] = useState("");
  const [transferRef, setTransferRef] = useState("");
  const [mixedCashRaw, setMixedCashRaw] = useState("");
  const [mixedTransferRaw, setMixedTransferRaw] = useState("");
  const [creditCashRaw, setCreditCashRaw] = useState("");
  const [creditTransferRaw, setCreditTransferRaw] = useState("");

  const closeQuickCustomerModal = useCallback(() => {
    setQuickModalOpen(false);
    setQuickError(null);
    setQuickName("");
    setQuickDocument("");
  }, []);

  const applyPosProfile = useCallback(
    (json: {
      shipOptions?: ShipOption[];
      customer?: {
        customer_kind?: string | null;
        wholesale_discount_percent?: number | null;
      };
    }) => {
      const options =
        json.shipOptions && json.shipOptions.length > 0
          ? json.shipOptions
          : [PICKUP_SHIP_OPTION];
      setShipOptions(options);

      const savedShip = editQuotation?.shippingAddress?.trim() ?? "";
      if (!editShipHydratedRef.current && savedShip) {
        editShipHydratedRef.current = true;
        const isPickup =
          /retiro\s+en\s+tienda/i.test(savedShip) ||
          savedShip.toLowerCase() === "pickup";
        if (isPickup) {
          setShipChoice("pickup");
        } else {
          const match = options.find(
            (o) =>
              o.kind === "address" &&
              (savedShip.includes(o.detail) ||
                savedShip.includes(o.label) ||
                `${o.label} — ${o.detail}` === savedShip ||
                `${o.label} - ${o.detail}` === savedShip),
          );
          setShipChoice(match?.id ?? options[0]!.id);
        }
      } else {
        setShipChoice((cur) =>
          cur && options.some((o) => o.id === cur) ? cur : options[0]!.id,
        );
      }
      setPosCustomerKind(parseStoreCustomerKind(json.customer?.customer_kind));
      setCustomerWholesalePct(
        wholesaleDiscountPercentFromRow(json.customer ?? {}),
      );
    },
    [editQuotation?.shippingAddress],
  );

  const loadCustomerProfile = useCallback(
    async (id: string) => {
      const gen = ++shipLoadGenRef.current;
      // Retiro en tienda al instante: no bloquear Envío ni Confirmar.
      setShipOptions([PICKUP_SHIP_OPTION]);
      setShipChoice("pickup");
      setShipLoading(true);
      try {
        const res = await fetch(`/api/admin/customers/${id}/pos-profile`, {
          cache: "no-store",
        });
        if (gen !== shipLoadGenRef.current) return;
        if (!res.ok) {
          setCustomerWholesalePct(0);
          setPosCustomerKind("retail");
          return;
        }
        const json = (await res.json()) as {
          shipOptions?: ShipOption[];
          customer?: {
            customer_kind?: string | null;
            wholesale_discount_percent?: number | null;
          };
        };
        if (gen !== shipLoadGenRef.current) return;
        applyPosProfile(json);
        profileAppliedForIdRef.current = id;
      } finally {
        if (gen === shipLoadGenRef.current) setShipLoading(false);
      }
    },
    [applyPosProfile],
  );

  const searchCustomers = useCallback(async (q: string, signal?: AbortSignal) => {
    const trimmed = q.trim();
    if (trimmed.length < 1) {
      setCustomerHits([]);
      setCustomerSearchError(null);
      return;
    }
    setCustomerLoading(true);
    setCustomerSearchError(null);
    const { signal: timed, cleanup } = abortSignalWithTimeout(
      ADMIN_SEARCH_TIMEOUT_MS,
      signal,
    );
    try {
      const res = await fetch(
        `/api/admin/customers-search?q=${encodeURIComponent(trimmed)}`,
        { cache: "no-store", signal: timed },
      );
      if (!res.ok) {
        if (!timed.aborted) {
          setCustomerHits([]);
          setCustomerSearchError(
            res.status === 401
              ? "Sesión expirada. Recargá e iniciá sesión."
              : "No se pudo buscar. Tocá para reintentar.",
          );
        }
        return;
      }
      const j = (await res.json()) as { customers?: CustomerHit[] };
      if (!timed.aborted) {
        setCustomerHits(j.customers ?? []);
        setCustomerSearchError(null);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Abort del useEffect (cleanup): no mostrar error.
        if (signal?.aborted) return;
        setCustomerHits([]);
        setCustomerSearchError("La búsqueda tardó demasiado. Reintentá.");
        return;
      }
      if (!signal?.aborted) {
        setCustomerHits([]);
        setCustomerSearchError("No se pudo buscar. Reintentá.");
      }
    } finally {
      cleanup();
      if (!signal?.aborted) setCustomerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (editQuotation) return;
    if (!initialCustomerId) return;
    let cancelled = false;
    profileAppliedForIdRef.current = null;
    setShipOptions([PICKUP_SHIP_OPTION]);
    setShipChoice("pickup");
    setShipLoading(true);
    void fetch(`/api/admin/customers/${initialCustomerId}/pos-profile`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as {
          shipOptions?: ShipOption[];
          customer?: {
            id: string;
            name: string;
            email?: string | null;
            phone?: string | null;
            document_id?: string | null;
            customer_kind?: string | null;
            wholesale_discount_percent?: number | null;
          };
        };
        const c = json.customer;
        if (!c?.id || cancelled) return;
        applyPosProfile(json);
        profileAppliedForIdRef.current = c.id;
        setCustomer({
          id: c.id,
          name: c.name,
          email: c.email ?? null,
          phone: c.phone ?? null,
          document_id: c.document_id ?? null,
        });
        setCustomerQuery("");
        setCustomerHits([]);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setShipLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialCustomerId, applyPosProfile]);

  useEffect(() => {
    if (!customer) {
      profileAppliedForIdRef.current = null;
      setShipOptions([]);
      setShipChoice(null);
      setPosCustomerKind("retail");
      setCustomerWholesalePct(0);
      setShipLoading(false);
      return;
    }
    if (profileAppliedForIdRef.current === customer.id) return;
    void loadCustomerProfile(customer.id);
  }, [customer, loadCustomerProfile]);

  useEffect(() => {
    if (!quickModalOpen) return;
    const t = window.setTimeout(() => quickNameInputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [quickModalOpen]);

  useEffect(() => {
    if (!quickModalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeQuickCustomerModal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quickModalOpen, closeQuickCustomerModal]);

  async function submitQuickCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (quickPending) return;
    setQuickError(null);
    setQuickPending(true);
    const res = await createQuickStoreCustomer({
      name: quickName,
      document_id: quickDocument,
    });
    setQuickPending(false);
    if (!res.ok) {
      if (res.code === "auth") {
        setQuickError("Sesión expirada. Recarga la página e inicia sesión de nuevo.");
      } else if (res.code === "forbidden") {
        setQuickError("No tenés permiso para crear clientes.");
      } else if (res.code === "duplicate_document") {
        setQuickError("Ya existe un cliente con esa cédula o documento.");
      } else if (res.code === "name") {
        setQuickError("El nombre es obligatorio.");
      } else {
        setQuickError(adminCreateFailedMessage("customer"));
      }
      return;
    }
    setCustomer({
      id: res.customer.id,
      name: res.customer.name,
      email: res.customer.email,
      phone: res.customer.phone,
      document_id: res.customer.document_id,
    });
    setCustomerQuery("");
    setCustomerHits([]);
    closeQuickCustomerModal();
  }

  useEffect(() => {
    const q = debouncedProductQ.trim();
    if (q.length < 1) {
      setProductHits([]);
      return;
    }
    const ac = new AbortController();
    const { signal: timed, cleanup } = abortSignalWithTimeout(
      ADMIN_SEARCH_TIMEOUT_MS,
      ac.signal,
    );
    setProductLoading(true);
    void fetch(`/api/admin/products-search?q=${encodeURIComponent(q)}`, {
      signal: timed,
    })
      .then(async (r) => {
        if (!r.ok) return { products: [] as ProductHit[] };
        return r.json() as Promise<{ products?: ProductHit[] }>;
      })
      .then((j) => {
        if (!ac.signal.aborted) setProductHits(j.products ?? []);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!ac.signal.aborted) setProductHits([]);
      })
      .finally(() => {
        cleanup();
        if (!ac.signal.aborted) setProductLoading(false);
      });
    return () => {
      ac.abort();
      cleanup();
    };
  }, [debouncedProductQ]);

  useEffect(() => {
    if (!canUseKits) {
      setKitHits([]);
      setKitLoading(false);
      return;
    }
    const q = debouncedKitQ.trim();
    if (q.length < 1) {
      setKitHits([]);
      return;
    }
    const ac = new AbortController();
    const { signal: timed, cleanup } = abortSignalWithTimeout(
      ADMIN_SEARCH_TIMEOUT_MS,
      ac.signal,
    );
    setKitLoading(true);
    void fetch(`/api/admin/kits-search?q=${encodeURIComponent(q)}`, {
      signal: timed,
    })
      .then(async (r) => {
        if (!r.ok) return { kits: [] as KitHit[] };
        return r.json() as Promise<{ kits?: KitHit[] }>;
      })
      .then((j) => {
        if (!ac.signal.aborted) setKitHits(j.kits ?? []);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!ac.signal.aborted) setKitHits([]);
      })
      .finally(() => {
        cleanup();
        if (!ac.signal.aborted) setKitLoading(false);
      });
    return () => {
      ac.abort();
      cleanup();
    };
  }, [debouncedKitQ, canUseKits]);

  useEffect(() => {
    const ac = new AbortController();
    void searchCustomers(debouncedCustomerQ, ac.signal);
    return () => ac.abort();
  }, [debouncedCustomerQ, searchCustomers]);

  useEffect(() => {
    function refreshCustomerSearch() {
      if (document.visibilityState !== "visible") return;
      const q = debouncedCustomerQ.trim();
      if (q.length < 1) return;
      void searchCustomers(q);
    }
    window.addEventListener("focus", refreshCustomerSearch);
    document.addEventListener("visibilitychange", refreshCustomerSearch);
    return () => {
      window.removeEventListener("focus", refreshCustomerSearch);
      document.removeEventListener("visibilitychange", refreshCustomerSearch);
    };
  }, [debouncedCustomerQ, searchCustomers]);

  const kitSubtotalCents = useMemo(() => {
    let s = 0;
    for (const line of kitLines) {
      s += line.kit.price_cents * line.quantity;
    }
    return s;
  }, [kitLines]);

  const pricingByKey = useMemo(() => {
    const m = new Map<string, ReturnType<typeof linePricing>>();
    for (const line of lines) {
      m.set(line.key, linePricing(line, customerWholesalePct, pricePolicy, chargeVat));
    }
    return m;
  }, [lines, customerWholesalePct, pricePolicy, chargeVat]);

  const subtotalCents = useMemo(() => {
    let s = kitSubtotalCents;
    for (const p of pricingByKey.values()) s += p.lineNetAfter;
    return s;
  }, [pricingByKey, kitSubtotalCents]);

  const wholesaleSavingsNetCents = useMemo(() => {
    if (customerWholesalePct <= 0) return 0;
    let s = 0;
    for (const line of lines) {
      s += catalogLineNetCents(line, 0) - catalogLineNetCents(line, customerWholesalePct);
    }
    return s;
  }, [lines, customerWholesalePct]);

  const catalogNetSubtotalCents = useMemo(() => {
    let s = 0;
    for (const line of lines) {
      s += catalogLineNetCents(line, 0);
    }
    return s;
  }, [lines]);

  const vatCents = useMemo(() => {
    let s = 0;
    for (const line of lines) {
      const p = pricingByKey.get(line.key);
      if (p) s += p.unitFinal * line.quantity - p.lineNetAfter;
    }
    return s;
  }, [lines, pricingByKey]);

  const priceBlocked = useMemo(
    () => [...pricingByKey.values()].some((p) => p.violatesPolicy),
    [pricingByKey],
  );

  const totalCents = subtotalCents + vatCents;

  const cartStockExceeded = useMemo(() => {
    const byId = new Map<string, number>();
    const stockById = new Map<string, number>();
    for (const l of lines) {
      const pid = l.product.id;
      byId.set(pid, (byId.get(pid) ?? 0) + l.quantity);
      if (!stockById.has(pid)) {
        stockById.set(
          pid,
          Number(l.product.stock_local ?? l.product.stock_quantity ?? 0),
        );
      }
    }
    for (const [pid, sum] of byId) {
      if (sum > (stockById.get(pid) ?? 0)) return true;
    }
    for (const kl of kitLines) {
      let sum = 0;
      for (const l of kitLines) {
        if (l.kit.id === kl.kit.id) sum += l.quantity;
      }
      if (sum > kl.kit.max_stock) return true;
    }
    return false;
  }, [lines, kitLines]);

  const selectedShipOption = useMemo(
    () => shipOptions.find((o) => o.id === shipChoice) ?? null,
    [shipOptions, shipChoice],
  );

  const savedAddressOptions = useMemo(
    () => shipOptions.filter((o): o is Extract<ShipOption, { kind: "address" }> => o.kind === "address"),
    [shipOptions],
  );

  const cashGivenCents = parseCopInputDigitsToInt(cashGivenRaw);
  const mixedCashCents = parseCopInputDigitsToInt(mixedCashRaw);
  const mixedTransferCents = parseCopInputDigitsToInt(mixedTransferRaw);
  const creditCashCents = parseCopInputDigitsToInt(creditCashRaw);
  const creditTransferCents = parseCopInputDigitsToInt(creditTransferRaw);
  const creditDownCents = creditCashCents + creditTransferCents;
  const creditPendingCents = Math.max(0, totalCents - creditDownCents);
  const creditCustomerBlocked =
    payment === "credit" &&
    (customer == null || isDefaultPosCustomerName(customer.name));
  const creditDownOk = creditDownCents < totalCents;

  const changeCents =
    payment === "cash" && cashGivenCents >= totalCents
      ? cashGivenCents - totalCents
      : null;

  const mixedOk =
    mixedCashCents + mixedTransferCents === totalCents && totalCents > 0;

  /** Efectivo y transferencia no exigen campos extra; el monto en efectivo es solo ayuda para el vuelto. */
  const paymentOk =
    skipsStockGate ||
    (payment === "mixed"
      ? mixedOk
      : payment === "credit"
        ? creditDownOk && !creditCustomerBlocked
        : true);

  const mesaOk =
    documentKind !== "pedido" ||
    serviceType === "domicilio" ||
    (Boolean(diningTableId) &&
      availableTables.some((t) => t.id === diningTableId));

  const canSubmit =
    customer !== null &&
    (lines.length > 0 || kitLines.length > 0) &&
    (totalCents > 0 || (pricePolicy.allowBelow && totalCents === 0)) &&
    shipChoice !== null &&
    shipChoice !== "" &&
    (skipsStockGate || !cartStockExceeded) &&
    paymentOk &&
    !priceBlocked &&
    (documentKind !== "pedido" || Boolean(serviceType)) &&
    mesaOk;

  function selectCustomer(c: CustomerHit) {
    setCustomer(c);
    setCustomerQuery("");
    setCustomerHits([]);
  }

  function clearCustomer() {
    setCustomer(null);
    setCustomerWholesalePct(0);
    setPosCustomerKind("retail");
    setShipChoice(null);
    setShipOptions([]);
    setCustomerQuery("");
    setCustomerHits([]);
    window.setTimeout(() => customerSearchInputRef.current?.focus(), 0);
  }

  function onProductSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (productLoading) return;
    const first = skipsStockGate
      ? productHits[0]
      : productHits.find(
          (p) => Number(p.stock_local ?? p.stock_quantity ?? 0) >= 1,
        );
    if (first) addProduct(first);
  }

  function onKitSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (kitLoading) return;
    const first = skipsStockGate
      ? kitHits[0]
      : kitHits.find((k) => k.available && k.max_stock >= 1);
    if (first) addKit(first);
  }

  function onCustomerSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (customerLoading) return;
    const first = customerHits[0];
    if (first) selectCustomer(first);
  }

  function addProduct(p: ProductHit) {
    setLines((prev) => {
      const stock = Number(p.stock_local ?? p.stock_quantity ?? 0);
      if (!skipsStockGate && stock < 1) return prev;
      let sum = 0;
      for (const l of prev) {
        if (l.product.id === p.id) sum += l.quantity;
      }
      if (!skipsStockGate && sum + 1 > stock) return prev;
      return [
        ...prev,
        {
          key: crypto.randomUUID(),
          product: p,
          quantity: 1,
          discountMode: "none",
          discountPercent: 0,
          discountAmountRaw: "",
          chargedGrossRaw: "",
        },
      ];
    });
    setProductQuery("");
    setProductHits([]);
  }

  function setQty(key: string, q: number) {
    setLines((prev) => {
      const line = prev.find((l) => l.key === key);
      if (!line) return prev;
      const stock = Number(line.product.stock_local ?? line.product.stock_quantity ?? 0);
      let usedElsewhere = 0;
      for (const l of prev) {
        if (l.product.id === line.product.id && l.key !== key) usedElsewhere += l.quantity;
      }
      const maxQty = skipsStockGate
        ? 999
        : Math.max(1, stock - usedElsewhere);
      const next = Math.max(1, Math.min(maxQty, Math.floor(q)));
      return prev.map((l) => (l.key === key ? { ...l, quantity: next } : l));
    });
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function addKit(k: KitHit) {
    if (!skipsStockGate && (!k.available || k.max_stock < 1)) return;
    setKitLines((prev) => {
      let sum = 0;
      for (const l of prev) {
        if (l.kit.id === k.id) sum += l.quantity;
      }
      if (!skipsStockGate && sum + 1 > k.max_stock) return prev;
      const idx = prev.findIndex((l) => l.kit.id === k.id);
      if (idx >= 0) {
        return prev.map((l, i) =>
          i === idx ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        { key: crypto.randomUUID(), kit: k, quantity: 1 },
      ];
    });
    setKitQuery("");
    setKitHits([]);
  }

  function setKitQty(key: string, q: number) {
    setKitLines((prev) => {
      const line = prev.find((l) => l.key === key);
      if (!line) return prev;
      let usedElsewhere = 0;
      for (const l of prev) {
        if (l.kit.id === line.kit.id && l.key !== key) usedElsewhere += l.quantity;
      }
      const maxQty = skipsStockGate
        ? 999
        : Math.max(1, line.kit.max_stock - usedElsewhere);
      const next = Math.max(1, Math.min(maxQty, Math.floor(q)));
      return prev.map((l) => (l.key === key ? { ...l, quantity: next } : l));
    });
  }

  function removeKitLine(key: string) {
    setKitLines((prev) => prev.filter((l) => l.key !== key));
  }

  function setLineDiscountMode(key: string, mode: LineDiscountMode) {
    setLines((prev) =>
      prev.map((line) =>
        line.key !== key
          ? line
          : {
              ...line,
              discountMode: mode,
              ...(mode === "none"
                ? { discountPercent: 0, discountAmountRaw: "" }
                : mode === "percent"
                  ? { discountAmountRaw: "" }
                  : { discountPercent: 0 }),
            },
      ),
    );
  }

  function setLineDiscountPercent(key: string, v: number) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, discountPercent: v } : line)),
    );
  }

  function setLineDiscountAmountRaw(key: string, raw: string) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, discountAmountRaw: raw } : line)),
    );
  }

  function setLineChargedGross(key: string, raw: string) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, chargedGrossRaw: raw } : line)),
    );
  }

  const payloadJson = useMemo(() => {
    if (!customer) return "";
    let address: string | null = null;
    if (!shipChoice || shipChoice === "pickup") {
      address = "Retiro en tienda";
    } else {
      const opt = shipOptions.find((o) => o.id === shipChoice);
      if (!opt || opt.kind === "pickup") {
        address = "Retiro en tienda";
      } else {
        address = [opt.label, opt.detail].filter(Boolean).join(" — ");
      }
    }
    const phone = customer.phone?.trim() || null;
    return JSON.stringify({
      customerId: customer.id,
      quotationOrderId: editQuotation?.orderId ?? null,
      lines: lines.map((l) => {
        const pct = effectiveLineDiscountPercent(l);
        const amt =
          pct != null
            ? 0
            : effectiveLineDiscountAmountCents(l, customerWholesalePct, pricePolicy, chargeVat);
        const chargedUnitCents = lineChargedUnitCents(l, customerWholesalePct, chargeVat);
        return {
          productId: l.product.id,
          quantity: l.quantity,
          discountPercent: pct,
          discountAmountCents: amt,
          chargedUnitCents,
        };
      }),
      kitLines: kitLines.map((l) => ({
        kitId: l.kit.id,
        quantity: l.quantity,
      })),
      paymentMethod: payment,
      documentKind: editingQuotation ? "quotation" : documentKind,
      serviceType: documentKind === "pedido" ? serviceType : null,
      diningTableId:
        documentKind === "pedido" && diningTableId ? diningTableId : null,
      ...(payment === "mixed"
        ? {
            mixedCashCents: mixedCashCents,
            mixedTransferCents: mixedTransferCents,
          }
        : {}),
      ...(payment === "credit"
        ? {
            creditCashCents: creditCashCents,
            creditTransferCents: creditTransferCents,
          }
        : {}),
      shippingAddress: address,
      shippingPhone: phone,
      submissionId,
    });
  }, [
    customer,
    lines,
    kitLines,
    payment,
    documentKind,
    serviceType,
    diningTableId,
    editingQuotation,
    editQuotation?.orderId,
    mixedCashCents,
    mixedTransferCents,
    creditCashCents,
    creditTransferCents,
    shipChoice,
    shipOptions,
    customerWholesalePct,
    pricePolicy,
    submissionId,
  ]);

  const banner = errorMessage(initialError);

  return (
    <div className="flex flex-col gap-4">
      {banner ? (
        <p className="text-sm text-red-600 dark:text-red-400">{banner}</p>
      ) : null}

      <form
        action={createPosInvoiceAction}
        className="flex flex-col gap-0"
        onSubmit={(e) => onInvoiceFormSubmit(e, payloadJson)}
      >
        <input type="hidden" name="payload" value={payloadJson} readOnly />

        <div className="flex min-w-0 flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(28rem,32rem)] xl:items-start xl:gap-10">
          <section
            className={`${sectionClass} order-2 xl:order-none xl:col-start-1 xl:row-start-1`}
          >
            <h2 className={sectionTitle}>
              {canUseKits ? "Productos y kits" : "Productos"}
            </h2>
            <div className="relative mt-3">
              <input
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                onKeyDown={onProductSearchKeyDown}
                placeholder="Buscar producto por nombre o código"
                className={inputClass}
                autoComplete="off"
              />
              {productQuery.trim().length > 0 ? (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-md shadow-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-lg dark:shadow-black/30">
                  {productLoading ? (
                    <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                      Buscando…
                    </p>
                  ) : productHits.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                      Sin resultados.
                    </p>
                  ) : (
                    productHits.map((p) => {
                      const stock = Number(p.stock_local ?? p.stock_quantity ?? 0);
                      const blocked = !skipsStockGate && stock < 1;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addProduct(p)}
                          disabled={blocked}
                          className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm transition hover:bg-zinc-50/80 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-800/90"
                        >
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {p.name}
                          </span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {p.reference ? `${p.reference} · ` : null}
                            {formatCop(unitFinalCents(p, customerWholesalePct, chargeVat))}
                            {stock < 6
                              ? ` · Stock tienda: ${stock}${skipsStockGate && stock < 1 ? " (pedido sin stock)" : ""}`
                              : null}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              ) : null}
            </div>
            {canUseKits ? (
            <div className="relative mt-4">
              <input
                value={kitQuery}
                onChange={(e) => setKitQuery(e.target.value)}
                onKeyDown={onKitSearchKeyDown}
                placeholder="Buscar kit / combo"
                className={inputClass}
                autoComplete="off"
              />
              {kitQuery.trim().length > 0 ? (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-md shadow-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-lg dark:shadow-black/30">
                  {kitLoading ? (
                    <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                      Buscando…
                    </p>
                  ) : kitHits.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                      Sin kits disponibles.
                    </p>
                  ) : (
                    kitHits.map((k) => (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => addKit(k)}
                        disabled={
                          !skipsStockGate && (!k.available || k.max_stock < 1)
                        }
                        className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm transition hover:bg-zinc-50/80 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-800/90"
                      >
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {k.name}
                          <span className="ml-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                            Kit
                          </span>
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {formatCop(k.price_cents)}
                          {k.item_count > 0 ? ` · ${k.item_count} productos` : null}
                          {k.max_stock < 6 ? ` · Stock: ${k.max_stock}` : null}
                          {!k.is_published ? " · Borrador" : null}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
            ) : null}
          </section>

          <section
            className={`${sectionClass} order-3 xl:order-none xl:col-start-1 xl:row-start-2`}
          >
            <h2 className={sectionTitle}>Ítems seleccionados</h2>
            {lines.length === 0 && kitLines.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                {canUseKits
                  ? "Agrega productos o kits desde la búsqueda."
                  : "Agrega productos desde la búsqueda."}
              </p>
            ) : (
              <>
                <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
                {lines.map((line) => {
                  const stock = Number(
                    line.product.stock_local ?? line.product.stock_quantity ?? 0,
                  );
                  const w = customerWholesalePct;
                  let usedElsewhere = 0;
                  for (const l of lines) {
                    if (l.product.id === line.product.id && l.key !== line.key) {
                      usedElsewhere += l.quantity;
                    }
                  }
                  const maxQtyThisLine = skipsStockGate
                    ? 999
                    : Math.max(1, stock - usedElsewhere);
                  const priced =
                    pricingByKey.get(line.key) ?? linePricing(line, w, pricePolicy, chargeVat);
                  const lineTotal = priced.unitFinal * line.quantity;
                  const unitCatalogGross = priced.catalogGross;
                  const unitLineGross = priced.unitFinal;
                  const hasLineDiscount = priced.lineNetAfter < priced.lineNetBefore;
                  const maxDiscNet = priced.lineNetBefore;
                  const lineBlocked = priced.violatesPolicy;
                  const showChargedInput =
                    canEditLinePrice || line.chargedGrossRaw !== "";
                  const showDiscountControls =
                    pricePolicy.allowBelow || line.discountMode !== "none";
                  const discBtn =
                    "rounded-md px-2 py-1 text-[11px] font-medium transition";
                  return (
                    <li key={line.key} className="space-y-2 py-3 first:pt-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-zinc-800 dark:text-zinc-200">
                            {line.product.name}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {hasLineDiscount ||
                            unitLineGross !== unitCatalogGross ? (
                              <>
                                <span className="mr-1 line-through opacity-60">
                                  {formatCop(unitCatalogGross)}
                                </span>
                                <span className="font-medium text-zinc-700 dark:text-zinc-200">
                                  {formatCop(unitLineGross)} c/u
                                </span>
                              </>
                            ) : (
                              <span>{formatCop(unitCatalogGross)} c/u</span>
                            )}
                            {productChargesVat(line.product, chargeVat)
                              ? ` · IVA ${String(saleVatPercentLabel(true) ?? 0).replace(/\.0+$/, "")}%`
                              : ""}
                          </p>
                          {showChargedInput ? (
                            <label className="mt-1.5 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                              <span className="shrink-0">Cobrar</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder={formatCopInputGrouping(unitCatalogGross)}
                                value={line.chargedGrossRaw}
                                onChange={(e) =>
                                  setLineChargedGross(
                                    line.key,
                                    sanitizeCopIntegerTyping(e.target.value),
                                  )
                                }
                                onBlur={() => {
                                  const n = parseCopChargedPesos(line.chargedGrossRaw);
                                  if (n > 0) {
                                    setLineChargedGross(
                                      line.key,
                                      formatCopInputGrouping(n),
                                    );
                                  }
                                }}
                                className={[
                                  "w-40 rounded-md border bg-white px-3 py-1.5 text-sm tabular-nums text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100",
                                  lineBlocked
                                    ? "border-red-300 dark:border-red-800"
                                    : "border-zinc-200/90 dark:border-zinc-700",
                                ].join(" ")}
                                aria-invalid={lineBlocked ? true : undefined}
                              />
                            </label>
                          ) : null}
                          {lineBlocked ? (
                            <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                              {POS_PRICE_NOT_ALLOWED_MESSAGE}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className={btnIdle}
                            onClick={() => setQty(line.key, line.quantity - 1)}
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            className={btnIdle}
                            onClick={() => setQty(line.key, line.quantity + 1)}
                            disabled={line.quantity >= maxQtyThisLine}
                          >
                            +
                          </button>
                        </div>
                        <p className="text-sm tabular-nums text-zinc-800 dark:text-zinc-200">
                          {formatCop(lineTotal)}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeLine(line.key)}
                          className={removeLineBtnClass}
                          title="Quitar"
                          aria-label={`Quitar ${line.product.name}`}
                        >
                          <IconTrash />
                        </button>
                      </div>
                      {showDiscountControls ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="font-medium text-zinc-600 dark:text-zinc-300">
                          Descuento (neto línea)
                        </span>
                        <span className="inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
                          {(["none", "percent", "amount"] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setLineDiscountMode(line.key, mode)}
                              className={`${discBtn} ${
                                line.discountMode === mode
                                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                                  : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                              }`}
                            >
                              {mode === "none" ? "Ninguno" : mode === "percent" ? "%" : "$ COP"}
                            </button>
                          ))}
                        </span>
                        {line.discountMode === "percent" ? (
                          <label className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                            <span>%</span>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              inputMode="numeric"
                              value={line.discountPercent > 0 ? line.discountPercent : ""}
                              onChange={(e) =>
                                setLineDiscountPercent(
                                  line.key,
                                  Math.min(100, Math.max(0, Math.floor(Number(e.target.value) || 0))),
                                )
                              }
                              className="w-14 rounded-md border border-zinc-200/90 bg-white px-2 py-1 tabular-nums text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                            />
                          </label>
                        ) : null}
                        {line.discountMode === "amount" ? (
                          <label className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 sm:max-w-xs">
                            <span className="shrink-0 text-zinc-600 dark:text-zinc-300">Monto</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="0"
                              value={line.discountAmountRaw}
                              onChange={(e) =>
                                setLineDiscountAmountRaw(line.key, e.target.value.replace(/\D/g, ""))
                              }
                              className="min-w-0 flex-1 rounded-md border border-zinc-200/90 bg-white px-2 py-1 tabular-nums text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                            />
                            <span className="shrink-0 text-[10px] text-zinc-400">
                              máx. {formatCop(maxDiscNet)}
                            </span>
                          </label>
                        ) : null}
                      </div>
                      ) : null}
                    </li>
                  );
                })}
                {kitLines.map((line) => {
                  let usedElsewhere = 0;
                  for (const l of kitLines) {
                    if (l.kit.id === line.kit.id && l.key !== line.key) {
                      usedElsewhere += l.quantity;
                    }
                  }
                  const maxQtyThisLine = skipsStockGate
                    ? 999
                    : Math.max(1, line.kit.max_stock - usedElsewhere);
                  const lineTotal = line.kit.price_cents * line.quantity;
                  return (
                    <li key={line.key} className="py-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-zinc-800 dark:text-zinc-200">
                            {line.kit.name}
                            <span className="ml-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                              Kit
                            </span>
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {formatCop(line.kit.price_cents)} c/u
                            {line.kit.max_stock < 6
                              ? ` · Stock: ${line.kit.max_stock}`
                              : null}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className={btnIdle}
                            onClick={() => setKitQty(line.key, line.quantity - 1)}
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            className={btnIdle}
                            onClick={() => setKitQty(line.key, line.quantity + 1)}
                            disabled={line.quantity >= maxQtyThisLine}
                          >
                            +
                          </button>
                        </div>
                        <p className="text-sm tabular-nums text-zinc-800 dark:text-zinc-200">
                          {formatCop(lineTotal)}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeKitLine(line.key)}
                          className={removeLineBtnClass}
                          title="Quitar"
                          aria-label={`Quitar ${line.kit.name}`}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {cartStockExceeded && !skipsStockGate ? (
                <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                  La cantidad supera el stock disponible. Ajustá cantidades o quitá líneas.
                </p>
              ) : null}
              {cartStockExceeded && documentKind === "pedido" ? (
                <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                  Algunos ítems no tienen stock en tienda. El pedido se abre igual; el inventario se valida al cobrar.
                </p>
              ) : null}
              </>
            )}
          </section>

          <div
            className="
              contents
              xl:col-start-2 xl:row-start-1 xl:row-span-4
              xl:flex xl:flex-col xl:gap-0
              xl:sticky xl:top-20 xl:z-10 xl:self-start
              xl:border-l xl:border-zinc-200/70 xl:pl-8 dark:xl:border-zinc-800
              2xl:pl-10
            "
          >
            <section className={`${sectionClass} order-1 xl:order-none xl:border-t-0 xl:pt-0`}>
              <h2 className={sectionTitle}>
                Cliente <span className="text-red-600 dark:text-red-400">*</span>
              </h2>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <div className="relative min-w-0 flex-1">
                  {customer && customerQuery.trim().length === 0 ? (
                    <div
                      className={`${inputClass} flex items-center gap-2 pr-2`}
                    >
                      <Link
                        href={`/admin/customers/${customer.id}`}
                        className="min-w-0 flex-1 truncate font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                        title="Ver ficha del cliente"
                      >
                        {customer.name}
                      </Link>
                      {posCustomerKind === "wholesale" ? (
                        <span className="shrink-0 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                          Mayorista
                          {customerWholesalePct > 0
                            ? ` ${customerWholesalePct}%`
                            : ""}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={clearCustomer}
                        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                        title="Quitar cliente"
                        aria-label="Quitar cliente y buscar otro"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          className="size-3.5"
                          aria-hidden
                        >
                          <path
                            d="M18 6 6 18M6 6l12 12"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        ref={customerSearchInputRef}
                        value={customerQuery}
                        onChange={(e) => setCustomerQuery(e.target.value)}
                        onKeyDown={onCustomerSearchKeyDown}
                        placeholder="Buscar por nombre, cédula, email o teléfono"
                        className={inputClass}
                        autoComplete="off"
                      />
                      {customerQuery.trim().length > 0 ? (
                        <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-md shadow-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-lg dark:shadow-black/30">
                          {customerLoading ? (
                            <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                              Buscando…
                            </p>
                          ) : customerSearchError ? (
                            <button
                              type="button"
                              onClick={() =>
                                void searchCustomers(customerQuery.trim())
                              }
                              className="w-full px-3 py-2 text-left text-sm text-amber-800 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-950/40"
                            >
                              {customerSearchError}
                            </button>
                          ) : customerHits.length === 0 ? (
                            <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                              Sin resultados.
                            </p>
                          ) : (
                            customerHits.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => selectCustomer(c)}
                                className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm transition hover:bg-zinc-50/80 dark:hover:bg-zinc-800/90"
                              >
                                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                  {c.name}
                                </span>
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                  {[c.document_id, c.email, c.phone]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQuickError(null);
                    setQuickModalOpen(true);
                  }}
                  className={`${btnIdle} shrink-0 px-3 py-2.5`}
                >
                  + Nuevo cliente
                </button>
              </div>
            </section>

            <section className={`${sectionClass} order-4 xl:order-none`}>
              <h2 className={`${sectionTitle} flex items-center gap-2`}>
                <IconHome />
                Envío
              </h2>
              {!customer ? (
                <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                  Selecciona un cliente para habilitar el envío
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {shipLoading ? (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Actualizando direcciones…
                    </p>
                  ) : null}
                  <div>
                    <label className={labelClass}>Entrega</label>
                    <select
                      value={shipChoice ?? shipOptions[0]?.id ?? "pickup"}
                      onChange={(e) => setShipChoice(e.target.value || null)}
                      className={inputClass}
                    >
                      {(shipOptions.length > 0 ? shipOptions : [PICKUP_SHIP_OPTION]).map(
                        (o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                            {o.kind === "address" ? ` — ${o.detail}` : ""}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                  {selectedShipOption ? (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {selectedShipOption.label}
                      </span>
                      <span className="mx-1.5 text-zinc-400">·</span>
                      <span className="whitespace-pre-line">
                        {selectedShipOption.detail}
                      </span>
                    </p>
                  ) : null}
                  {shipChoice === "pickup" && savedAddressOptions.length > 0 ? (
                    <div className="border-t border-dashed border-zinc-200/80 pt-3 dark:border-zinc-700">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                        Otras direcciones guardadas
                      </p>
                      <ul className="mt-2 space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                        {savedAddressOptions.map((o) => (
                          <li key={o.id}>
                            <span className="font-medium text-zinc-800 dark:text-zinc-200">
                              {o.label}
                            </span>
                            <span className="text-zinc-400"> — </span>
                            <span className="whitespace-pre-line">{o.detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </section>

            <section className={`${sectionClass} order-5 xl:order-none`}>
              <h2 className={sectionTitle}>Tipo de pedido</h2>
              {editingQuotation ? (
                <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                  Estás editando una cotización. Al guardar se actualiza la misma
                  pre-factura (sin cobro ni descuento de stock).
                </p>
              ) : (
                <>
              <div className={segmentTrackClass}>
                {(
                  [
                    {
                      id: "en_el_lugar" as const,
                      label: "En el lugar",
                      hint: "Mesa del salón",
                    },
                    {
                      id: "domicilio" as const,
                      label: "Domicilio",
                      hint: "Para llevar / entrega",
                    },
                  ] as const
                ).map((tab) => {
                  const active = serviceType === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setDocumentKind("pedido");
                        setServiceType(tab.id);
                        if (tab.id === "en_el_lugar") {
                          setShipChoice("pickup");
                          if (
                            !diningTableId ||
                            !availableTables.some((t) => t.id === diningTableId)
                          ) {
                            setDiningTableId(availableTables[0]?.id ?? "");
                          }
                        }
                      }}
                      className={[
                        "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-2 py-2 text-center transition",
                        active ? segmentBtnActive : segmentBtnIdle,
                      ].join(" ")}
                    >
                      <span className="text-xs font-semibold sm:text-sm">{tab.label}</span>
                      <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                        {tab.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4">
                <label className={labelClass}>
                  Mesa
                  {serviceType === "en_el_lugar" ? (
                    <span className="text-red-600 dark:text-red-400"> *</span>
                  ) : (
                    <span className="font-normal text-zinc-400"> (opcional)</span>
                  )}
                </label>
                <select
                  value={diningTableId}
                  onChange={(e) => setDiningTableId(e.target.value)}
                  className={inputClass}
                  required={serviceType === "en_el_lugar"}
                >
                  {serviceType === "domicilio" ? (
                    <option value="">Sin mesa</option>
                  ) : (
                    <option value="" disabled>
                      Elegí una mesa
                    </option>
                  )}
                  {diningTables.map((t) => (
                    <option
                      key={t.id}
                      value={t.id}
                      disabled={t.occupied}
                    >
                      {t.name}
                      {t.code ? ` · ${t.code}` : ""}
                      {t.seats > 0 ? ` · ${t.seats} puestos` : ""}
                      {t.occupied ? " · Ocupada" : ""}
                    </option>
                  ))}
                </select>
                {serviceType === "en_el_lugar" && availableTables.length === 0 ? (
                  <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                    No hay mesas libres. Liberá una en el mapa del salón o elegí domicilio.
                  </p>
                ) : null}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                El pedido queda abierto sin cobro ni descuento de stock. El cobro se hace después.
              </p>
                </>
              )}
            </section>

            {documentKind === "sale" ? (
            <section className={`${sectionClass} order-5 xl:order-none`}>
              <h2 className={sectionTitle}>Método de pago</h2>
              <div className={segmentTrackClass}>
                {(
                  [
                    { id: "cash" as const, label: "Efectivo", icon: <IconCoin /> },
                    { id: "transfer" as const, label: "Transferencia", icon: <IconCard /> },
                    { id: "mixed" as const, label: "Mixto", icon: <IconGrid /> },
                    ...(canUseCredit
                      ? [
                          {
                            id: "credit" as const,
                            label: "Crédito",
                            icon: <IconNotebook />,
                          },
                        ]
                      : []),
                  ]
                ).map((tab) => {
                  const active = payment === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPayment(tab.id)}
                      className={[
                        "flex flex-1 flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-center text-xs font-medium transition sm:flex-row sm:text-sm",
                        active ? segmentBtnActive : segmentBtnIdle,
                      ].join(" ")}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {payment === "cash" ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Cuánto me dieron</label>
                    <input
                      value={cashGivenRaw}
                      onChange={(e) => setCashGivenRaw(e.target.value)}
                      inputMode="numeric"
                      placeholder="Opcional"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Cuánto regreso</label>
                    <p className="mt-1.5 text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                      {changeCents !== null ? formatCop(changeCents) : "—"}
                    </p>
                  </div>
                </div>
              ) : null}

              {payment === "transfer" ? (
                <div className="mt-4">
                  <label className={labelClass}>Referencia (opcional)</label>
                  <input
                    value={transferRef}
                    onChange={(e) => setTransferRef(e.target.value)}
                    className={inputClass}
                    placeholder="Ej. comprobante #12345"
                  />
                </div>
              ) : null}

              {payment === "mixed" ? (
                <div className="mt-4 space-y-3">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Los importes en efectivo y transferencia deben sumar el total exacto.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Efectivo</label>
                      <input
                        value={mixedCashRaw}
                        onChange={(e) => setMixedCashRaw(e.target.value)}
                        inputMode="numeric"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Transferencia</label>
                      <input
                        value={mixedTransferRaw}
                        onChange={(e) => setMixedTransferRaw(e.target.value)}
                        inputMode="numeric"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  {!mixedOk && totalCents > 0 ? (
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      La suma debe ser {formatCop(totalCents)}.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {payment === "credit" ? (
                <div className="mt-4 space-y-3">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    La venta cuenta hoy y baja stock. Caja solo se mueve con el
                    abono inicial. El resto queda como deuda del cliente.
                  </p>
                  {creditCustomerBlocked ? (
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      Elegí un cliente nominado. Cliente Final no puede llevar crédito.
                    </p>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Abono efectivo</label>
                      <input
                        value={creditCashRaw}
                        onChange={(e) => setCreditCashRaw(e.target.value)}
                        inputMode="numeric"
                        placeholder="0"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Abono transferencia</label>
                      <input
                        value={creditTransferRaw}
                        onChange={(e) => setCreditTransferRaw(e.target.value)}
                        inputMode="numeric"
                        placeholder="0"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <p className="text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    Pendiente:{" "}
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatCop(creditPendingCents)}
                    </span>
                  </p>
                  {!creditDownOk && totalCents > 0 ? (
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      El abono tiene que ser menor al total. Si cubre todo, usá
                      Efectivo, Transferencia o Mixto.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>
            ) : null}

            <section className={`${sectionClass} order-6 xl:order-none`}>
              <h2 className={sectionTitle}>Resumen</h2>
              <dl className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {wholesaleSavingsNetCents > 0 ? (
                    <>
                      <div className="flex justify-between gap-2">
                        <dt>Subtotal (precio de lista)</dt>
                        <dd className="tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                          {formatCop(catalogNetSubtotalCents)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-emerald-700 dark:text-emerald-400">
                          Descuento mayorista ({customerWholesalePct}%)
                        </dt>
                        <dd className="tabular-nums font-medium text-emerald-800 dark:text-emerald-300">
                          −{formatCop(wholesaleSavingsNetCents)}
                        </dd>
                      </div>
                    </>
                  ) : posCustomerKind === "wholesale" &&
                    customerWholesalePct <= 0 &&
                    lines.length > 0 ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Cliente mayorista sin porcentaje de descuento configurado en su ficha.
                    </p>
                  ) : null}
                  <div className="flex justify-between gap-2">
                    <dt>
                      Subtotal
                      {customerWholesalePct > 0 ? (
                        <span className="mt-0.5 block text-[10px] font-normal normal-case text-zinc-400 dark:text-zinc-500">
                          (neto mercancía)
                        </span>
                      ) : null}
                    </dt>
                    <dd className="tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                      {formatCop(subtotalCents)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 border-t border-zinc-200/70 pt-2 dark:border-zinc-800">
                    <dt>{chargeVat ? "IVA" : "IVA (N/A)"}</dt>
                    <dd className="tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                      {chargeVat ? formatCop(vatCents) : formatCop(0)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 border-t border-zinc-200/70 pt-2 dark:border-zinc-800">
                    <dt className="font-medium text-zinc-800 dark:text-zinc-200">
                      {documentKind === "quotation"
                        ? "Total cotizado"
                        : documentKind === "pedido"
                          ? "Total del pedido"
                          : "Total a cobrar"}
                    </dt>
                    <dd className="text-xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
                      {formatCop(totalCents)}
                    </dd>
                  </div>
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                {editingQuotation
                  ? "Los cambios reemplazan la cotización actual. Después podés facturarla desde el detalle."
                  : documentKind === "pedido"
                    ? serviceType === "en_el_lugar"
                      ? "Se abre el pedido en la mesa elegida, sin cobro ni descuento de stock."
                      : "Se abre el pedido a domicilio, sin cobro ni descuento de stock."
                    : documentKind === "quotation"
                      ? "Se guarda como cotización (pre-factura) sin cobro ni descuento de stock."
                      : "Verificá cliente, productos y pago antes de confirmar."}
              </p>
              <ConfirmInvoiceButton
                disabled={!canSubmit}
                documentKind={documentKind}
                editingQuotation={editingQuotation}
              />
            </section>
          </div>
        </div>
      </form>

      {quickModalOpen
        ? createPortal(
            <AdminPortalRoot>
              <>
                <button
                  type="button"
                  className="fixed inset-x-0 bottom-0 top-14 z-[100] bg-zinc-950/40 backdrop-blur-sm dark:bg-black/50 sm:top-16 lg:left-64"
                  aria-label="Cerrar"
                  onClick={closeQuickCustomerModal}
                />
                <div className="pointer-events-none fixed inset-x-0 bottom-0 top-14 z-[101] flex items-center justify-center p-4 sm:top-16 sm:p-6 lg:left-64">
                  <div
                    className="pointer-events-auto relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_24px_64px_-24px_rgba(0,0,0,0.6)]"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="quick-customer-title"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h2
                        id="quick-customer-title"
                        className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
                      >
                        Nuevo cliente rápido
                      </h2>
                      <button
                        type="button"
                        onClick={closeQuickCustomerModal}
                        className="rounded-lg p-1.5 text-lg leading-none text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                        aria-label="Cerrar"
                      >
                        ×
                      </button>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      Nombre y cédula para facturar ya. La factura en curso no se
                      pierde.
                    </p>
                    <form onSubmit={submitQuickCustomer} className="mt-5 space-y-4">
                      {quickError ? (
                        <p className="text-sm text-red-600 dark:text-red-400">
                          {quickError}
                        </p>
                      ) : null}
                      <div>
                        <label htmlFor="quick-customer-name" className={labelClass}>
                          Nombre{" "}
                          <span className="text-red-600 dark:text-red-400">*</span>
                        </label>
                        <input
                          ref={quickNameInputRef}
                          id="quick-customer-name"
                          value={quickName}
                          onChange={(e) => setQuickName(e.target.value)}
                          className={inputClass}
                          placeholder="Nombre del cliente"
                          autoComplete="name"
                        />
                      </div>
                      <div>
                        <label htmlFor="quick-customer-doc" className={labelClass}>
                          Cédula / documento
                        </label>
                        <input
                          id="quick-customer-doc"
                          value={quickDocument}
                          onChange={(e) => setQuickDocument(e.target.value)}
                          className={inputClass}
                          placeholder="Ej. 12.345.678"
                          autoComplete="off"
                        />
                      </div>
                      <div className="flex flex-row items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={closeQuickCustomerModal}
                          className={adminButtonCancelClass}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={quickPending}
                          className="rounded-lg border border-[var(--admin-coral)] bg-[var(--admin-coral)] px-4 py-2.5 text-sm font-medium text-white transition hover:border-[var(--admin-coral-hover)] hover:bg-[var(--admin-coral-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {quickPending ? "Guardando…" : "Crear y usar"}
                        </button>
                      </div>
                      <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
                        <Link
                          href="/admin/customers/new?return=%2Fadmin%2Fventas%2Fnueva"
                          className="font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:decoration-zinc-600 dark:hover:text-zinc-100"
                          onClick={closeQuickCustomerModal}
                        >
                          Ficha completa con direcciones y más datos
                        </Link>
                      </p>
                    </form>
                  </div>
                </div>
              </>
            </AdminPortalRoot>,
            document.body,
          )
        : null}
    </div>
  );
}
