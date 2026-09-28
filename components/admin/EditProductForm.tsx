"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  AdminDateInput,
  ProductMoneyInput,
  productInputClass as inputClass,
  productSectionTitle as sectionTitle,
} from "@/components/admin/product-form-primitives";
import type { FragranceRowInitial } from "@/components/admin/ProductFragranceRows";
import type { ProductCategoryOption } from "@/components/admin/NewProductForm";
import { UpdateProductStockModal } from "@/components/admin/UpdateProductStockModal";
import { ProductDeleteConfirmForm } from "@/components/admin/ProductDeleteConfirmForm";
import { formatCop } from "@/lib/money";
import {
  assertProductImageSize,
  blockSubmitIfImageTooLarge,
  MAX_PRODUCT_IMAGE_BYTES,
} from "@/lib/product-image-upload";
import { SALE_VAT_PERCENT } from "@/lib/product-vat-price";
import { shouldUnoptimizeStorageImageUrl } from "@/lib/storage-public-url";
import { ProductFragranceRows } from "@/components/admin/ProductFragranceRows";
import {
  ProductSizeRows,
  type SizeRowState,
} from "@/components/admin/ProductSizeRows";
import {
  defaultProductCatalogFields,
  type ProductCatalogFields,
} from "@/lib/product-catalog-fields";
import type { MenuItemKind } from "@/lib/menu-item-kind";
import { MenuItemKindBadge } from "@/components/admin/MenuItemKindBadge";

const filterLabelClass =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500";

export type RecipeCostEstimateSummary = {
  estimatedCostCents: number;
  isPartial: boolean;
  missingCostCount: number;
  lineCount: number;
  recipeName: string | null;
  variantCount: number;
};

const sectionClass =
  "border-t border-zinc-200/70 pt-5 dark:border-zinc-800";

const btnIcon =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800";

const btnIdle =
  "inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800";

const btnPrimary =
  "inline-flex w-full items-center justify-center rounded-lg border border-[var(--admin-coral)] bg-[var(--admin-coral)] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-[var(--admin-coral-hover)] hover:bg-[var(--admin-coral-hover)] disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:border-zinc-700 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400";

type Initial = {
  name: string;
  reference: string;
  description: string;
  brand: string;
  categoryId: string;
  priceCents: number;
  costCents: number;
  costGrossCents: number;
  stockLocal: number;
  stockWarehouse: number;
  isPublished: boolean;
  sizeRows: SizeRowState[];
  hasExpiration: boolean;
  expirationDate: string;
  hasVat: boolean;
  vatPercent: number | null;
  colors: string[];
  fragranceRows: FragranceRowInitial[];
};

type Props = {
  productId: string;
  formAction: (formData: FormData) => void;
  categories: ProductCategoryOption[];
  initial: Initial;
  currentImageUrl: string | null;
  catalogFields?: ProductCatalogFields;
  /** Cuenta cobra IVA (`storefront_config.charge_vat`). */
  chargeVat?: boolean;
  menuKind?: MenuItemKind;
  recipeCost?: RecipeCostEstimateSummary | null;
};

export function EditProductHeader({
  productId,
  productName,
  referenceLabel,
  stockLocal,
  menuKind = "reventa",
}: {
  productId: string;
  productName: string;
  referenceLabel: string;
  stockLocal: number;
  menuKind?: MenuItemKind;
}) {
  const [stockOpen, setStockOpen] = useState(false);
  const crumb =
    productName.trim().length > 36
      ? `${productName.trim().slice(0, 35)}…`
      : productName.trim();

  return (
    <>
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 gap-y-2">
        <div className="min-w-0">
          <p className="text-[11px] text-zinc-500">
            <Link
              href="/admin/products"
              className="hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Menú
            </Link>
            <span className="mx-1.5 text-zinc-400 dark:text-zinc-600">/</span>
            <Link
              href={`/admin/products/${productId}`}
              className="hover:text-zinc-800 dark:hover:text-zinc-200"
              title={productName}
            >
              {crumb || "Ítem"}
            </Link>
            <span className="mx-1.5 text-zinc-400 dark:text-zinc-600">/</span>
            <span className="text-zinc-600 dark:text-zinc-400">Editar</span>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-xl">
              Editar ítem del menú
            </h1>
            <MenuItemKindBadge kind={menuKind} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStockOpen(true)}
            className={btnIdle}
            title="Actualizar stock del punto"
          >
            Stock
          </button>
          <ProductDeleteConfirmForm
            productId={productId}
            productName={productName}
            variant="header"
          />
          <Link
            href={`/admin/products/${productId}`}
            className={btnIcon}
            aria-label="Volver al detalle"
            title="Volver"
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
      </header>
      <UpdateProductStockModal
        open={stockOpen}
        onClose={() => setStockOpen(false)}
        productId={productId}
        productName={productName}
        referenceLabel={referenceLabel}
        stockLocal={stockLocal}
        returnTo={`/admin/products/${productId}/edit`}
      />
    </>
  );
}

export function EditProductForm({
  productId,
  formAction,
  categories,
  initial,
  currentImageUrl,
  catalogFields = defaultProductCatalogFields(),
  chargeVat = true,
  menuKind = "reventa",
  recipeCost = null,
}: Props) {
  const isElaborado = menuKind === "elaborado";
  const [name, setName] = useState(initial.name);
  const [reference, setReference] = useState(initial.reference);
  const [description, setDescription] = useState(initial.description);
  const [brand, setBrand] = useState(initial.brand);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [costCents, setCostCents] = useState(initial.costCents);
  const [costGrossCents, setCostGrossCents] = useState(initial.costGrossCents);
  const [priceCents, setPriceCents] = useState(initial.priceCents);
  const [isPublished, setIsPublished] = useState(initial.isPublished);
  const [hasExpiration, setHasExpiration] = useState(initial.hasExpiration);
  const [expirationDate, setExpirationDate] = useState(initial.expirationDate);
  const [hasVat, setHasVat] = useState(chargeVat && initial.hasVat);
  const [fileLabel, setFileLabel] = useState("Ningún archivo seleccionado");

  const categoryLabel =
    categories.find((c) => c.id === categoryId)?.name ?? "—";

  return (
    <form
      action={formAction}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)] lg:items-start lg:gap-8"
      onSubmit={(e) => {
        if (blockSubmitIfImageTooLarge(e.currentTarget)) {
          e.preventDefault();
        }
      }}
    >
      <input
        type="hidden"
        name="stock_local"
        value={String(initial.stockLocal)}
      />
      <input
        type="hidden"
        name="stock_warehouse"
        value={String(initial.stockWarehouse)}
      />

      <div className="min-w-0 space-y-0">
        <section>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="ep-name" className={filterLabelClass}>
                  Nombre del producto{" "}
                  <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  id="ep-name"
                  name="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="ep-ref" className={filterLabelClass}>
                  Referencia{" "}
                  <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  id="ep-ref"
                  name="reference"
                  required
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className={inputClass}
                />
              </div>
              {catalogFields.brand ? (
              <div>
                <label htmlFor="ep-brand" className={filterLabelClass}>
                  Marca
                </label>
                <input
                  id="ep-brand"
                  name="brand"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className={inputClass}
                />
              </div>
              ) : null}
              <div className="sm:col-span-2">
                <label htmlFor="ep-desc" className={filterLabelClass}>
                  Descripción
                </label>
                <textarea
                  id="ep-desc"
                  name="description"
                  rows={8}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={`${inputClass} min-h-[10rem] resize-y leading-relaxed`}
                />
              </div>
            </div>

            <div>
              <span className={filterLabelClass}>Imagen</span>
              <div className="flex flex-wrap items-start gap-3">
                {currentImageUrl ? (
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950">
                    <Image
                      src={currentImageUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="64px"
                      unoptimized={shouldUnoptimizeStorageImageUrl(
                        currentImageUrl,
                      )}
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer">
                      <span className={btnIdle}>Seleccionar archivo</span>
                      <input
                        name="image"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          const msg = assertProductImageSize(f ?? undefined);
                          if (msg) {
                            alert(msg);
                            e.target.value = "";
                            setFileLabel("Ningún archivo seleccionado");
                            return;
                          }
                          setFileLabel(
                            f ? f.name : "Ningún archivo seleccionado",
                          );
                        }}
                      />
                    </label>
                    <span className="text-xs text-zinc-500">{fileLabel}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-zinc-500">
                    JPG, PNG o WebP · máx.{" "}
                    {MAX_PRODUCT_IMAGE_BYTES / (1024 * 1024)} MB
                  </p>
                </div>
              </div>
            </div>

            {catalogFields.category ? (
            <div>
              <label htmlFor="ep-cat" className={filterLabelClass}>
                Categoría
              </label>
              <select
                id="ep-cat"
                name="category_id"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={inputClass}
              >
                <option value="">Seleccionar categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            ) : null}
          </div>
        </section>

        {catalogFields.sizes || catalogFields.fragrances ? (
        <section className={`${sectionClass} mt-6`}>
          <h2 className={sectionTitle}>Presentaciones</h2>
          <div className="mt-4 space-y-5">
            {catalogFields.sizes ? (
            <ProductSizeRows initialRows={initial.sizeRows} />
            ) : null}
            {catalogFields.colors
              ? initial.colors.map((color) => (
                  <input key={color} type="hidden" name="colors" value={color} />
                ))
              : null}
            {catalogFields.fragrances ? (
            <ProductFragranceRows initialRows={initial.fragranceRows} />
            ) : null}
          </div>
        </section>
        ) : null}

        <section className={`${sectionClass} mt-6`}>
          <h2 className={sectionTitle}>Opciones</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {catalogFields.expiration ? (
            <>
            <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
              <input
                type="checkbox"
                name="has_expiration"
                checked={hasExpiration}
                onChange={(e) => {
                  const next = e.target.checked;
                  setHasExpiration(next);
                  if (!next) setExpirationDate("");
                }}
                className="rounded border-zinc-300 accent-zinc-900 focus:ring-zinc-200/80 dark:border-zinc-600 dark:accent-zinc-100"
              />
              Tiene vencimiento
            </label>
            <div
              className={!hasExpiration ? "pointer-events-none opacity-50" : ""}
            >
              <label htmlFor="ep-expiration" className={filterLabelClass}>
                Fecha de vencimiento
              </label>
              <AdminDateInput
                id="ep-expiration"
                name="expiration_date"
                value={expirationDate}
                onChange={setExpirationDate}
                required={false}
              />
            </div>
            </>
            ) : null}
            {chargeVat ? (
            <>
            <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
              <input
                type="checkbox"
                name="has_vat"
                value="on"
                checked={hasVat}
                onChange={(e) => setHasVat(e.target.checked)}
                className="rounded border-zinc-300 accent-zinc-900 focus:ring-zinc-200/80 dark:border-zinc-600 dark:accent-zinc-100"
              />
              Maneja IVA ({SALE_VAT_PERCENT}%)
            </label>
            {hasVat ? (
              <input
                type="hidden"
                name="vat_percent"
                value={String(SALE_VAT_PERCENT)}
              />
            ) : null}
            </>
            ) : null}
            <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200 sm:col-span-2">
              <input
                type="checkbox"
                name="is_published"
                value="on"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="rounded border-zinc-300 accent-zinc-900 focus:ring-zinc-200/80 dark:border-zinc-600 dark:accent-zinc-100"
              />
              Publicado en la tienda
            </label>
          </div>
        </section>
      </div>

      <aside className="min-w-0 space-y-0 lg:sticky lg:top-24">
        <section>
          <h2 className={sectionTitle}>Información financiera</h2>
          <div className="mt-4 space-y-3">
            {isElaborado && recipeCost ? (
              <div className="rounded-lg border border-zinc-200/90 bg-zinc-50/80 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-950/50">
                <p className={filterLabelClass}>Costo estimado (receta)</p>
                <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-100">
                  {formatCop(recipeCost.estimatedCostCents)}
                </p>
                <p className="mt-1.5 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                  {recipeCost.recipeName
                    ? `Según BOM de «${recipeCost.recipeName}»`
                    : "Según insumos de la receta"}
                  {recipeCost.variantCount > 1
                    ? ` · ${recipeCost.variantCount} variantes (usa la receta por defecto)`
                    : null}
                  . Se actualiza con el costo unitario de cada insumo (Entrada en Insumos).
                </p>
                {recipeCost.isPartial || recipeCost.estimatedCostCents <= 0 ? (
                  <p className="mt-1.5 text-[11px] leading-snug text-amber-800 dark:text-amber-200">
                    {recipeCost.estimatedCostCents <= 0
                      ? "Estimación incompleta: cargá el costo unitario de los insumos en Inventario → Insumos."
                      : `Estimación parcial: faltan costos en ${recipeCost.missingCostCount} insumo${
                          recipeCost.missingCostCount === 1 ? "" : "s"
                        }.`}
                  </p>
                ) : null}
                {/* Conserva costo manual en BD hasta que exista override explícito */}
                <input
                  type="hidden"
                  name="cost_cents"
                  value={String(Math.max(0, Math.floor(costCents)))}
                />
                <input
                  type="hidden"
                  name="cost_gross_cents"
                  value={String(
                    Math.max(
                      0,
                      Math.floor(chargeVat ? costGrossCents : costCents),
                    ),
                  )}
                />
              </div>
            ) : chargeVat ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={filterLabelClass}>
                  Costo (sin IVA){" "}
                  <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <ProductMoneyInput
                  name="cost_cents"
                  value={costCents}
                  onChange={setCostCents}
                  required
                />
              </div>
              <div>
                <label className={filterLabelClass}>Costo con IVA</label>
                <ProductMoneyInput
                  name="cost_gross_cents"
                  value={costGrossCents}
                  onChange={setCostGrossCents}
                  required={false}
                />
              </div>
            </div>
            ) : (
            <div>
              <label className={filterLabelClass}>
                Costo{" "}
                <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <ProductMoneyInput
                name="cost_cents"
                value={costCents}
                onChange={setCostCents}
                required
              />
              <input
                type="hidden"
                name="cost_gross_cents"
                value={String(Math.max(0, Math.floor(costCents)))}
              />
            </div>
            )}
            <div>
              <label className={filterLabelClass}>
                Precio de venta{" "}
                <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <ProductMoneyInput
                name="price_cents"
                value={priceCents}
                onChange={setPriceCents}
                required
              />
            </div>
          </div>
        </section>

        <section className={`${sectionClass} mt-6`}>
          <h2 className={sectionTitle}>Resumen</h2>
          <dl className="mt-3 space-y-2.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Nombre</dt>
              <dd className="max-w-[60%] truncate text-right font-medium text-zinc-900 dark:text-zinc-100">
                {name.trim() || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Referencia</dt>
              <dd className="font-mono text-xs text-zinc-900 dark:text-zinc-100">
                {reference.trim() || "—"}
              </dd>
            </div>
            {catalogFields.category ? (
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Categoría</dt>
              <dd className="max-w-[55%] truncate text-right text-zinc-800 dark:text-zinc-200">
                {categoryLabel}
              </dd>
            </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Stock punto</dt>
              <dd className="tabular-nums text-zinc-800 dark:text-zinc-200">
                {initial.stockLocal}
              </dd>
            </div>
          </dl>

          <div className="mt-4 border-t border-zinc-200/70 pt-4 dark:border-zinc-800">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Precio de venta
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-100">
              {formatCop(priceCents)}
            </p>
          </div>

          <ul className="mt-3 space-y-1.5 text-sm">
            {isElaborado && recipeCost ? (
            <li className="flex justify-between text-zinc-500">
              <span>Costo estimado</span>
              <span className="tabular-nums text-zinc-800 dark:text-zinc-200">
                {formatCop(recipeCost.estimatedCostCents)}
              </span>
            </li>
            ) : (
            <li className="flex justify-between text-zinc-500">
              <span>{chargeVat ? "Costo s/IVA" : "Costo"}</span>
              <span className="tabular-nums text-zinc-800 dark:text-zinc-200">
                {formatCop(costCents)}
              </span>
            </li>
            )}
            {chargeVat && !isElaborado ? (
            <li className="flex justify-between text-zinc-500">
              <span>Costo c/IVA</span>
              <span className="tabular-nums text-zinc-800 dark:text-zinc-200">
                {formatCop(costGrossCents)}
              </span>
            </li>
            ) : null}
          </ul>

          <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
            Los cambios se reflejan en el catálogo. El stock se ajusta con
            Actualizar stock.
          </p>

          <button type="submit" className={`${btnPrimary} mt-4`}>
            Guardar cambios
          </button>
          <Link
            href={`/admin/products/${productId}`}
            className={`${btnIdle} mt-2 w-full`}
          >
            Cancelar
          </Link>
        </section>
      </aside>
    </form>
  );
}
