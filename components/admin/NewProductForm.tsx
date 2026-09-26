"use client";

import Link from "next/link";
import { useState } from "react";
import { createProduct } from "@/app/actions/admin/products";
import { AdminFormSubmitButton } from "@/components/admin/AdminFormSubmitButton";
import { formatCop, formatQuantityInputGrouping } from "@/lib/money";
import {
  AdminDateInput,
  ProductMoneyInput,
  ProductQuantityInput,
  productInputClass as inputClass,
  productLabelClass as labelClass,
  productSectionTitle as sectionTitle,
} from "@/components/admin/product-form-primitives";
import {
  assertProductImageSize,
  blockSubmitIfImageTooLarge,
  MAX_PRODUCT_IMAGE_BYTES,
} from "@/lib/product-image-upload";
import { SALE_VAT_PERCENT } from "@/lib/product-vat-price";
import { PRODUCT_COLOR_OPTIONS, productColorSwatchClass } from "@/lib/product-colors";
import type { FragranceRowInitial } from "@/components/admin/ProductFragranceRows";
import { ProductFragranceRows } from "@/components/admin/ProductFragranceRows";
import { ProductSizeRows } from "@/components/admin/ProductSizeRows";
import {
  defaultProductCatalogFields,
  type ProductCatalogFields,
} from "@/lib/product-catalog-fields";

export type ProductCategoryOption = { id: string; name: string };

const cardClass =
  "rounded-xl border border-zinc-200 bg-white p-4 shadow-sm ring-1 ring-zinc-950/5 sm:p-6 dark:border-zinc-700/90 dark:bg-zinc-900 dark:shadow-none dark:ring-white/[0.06]";

const summaryInset =
  "mt-4 rounded-lg border border-zinc-200/90 bg-white/60 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-950/60";

export function NewProductForm({
  categories,
  catalogFields = defaultProductCatalogFields(),
}: {
  categories: ProductCategoryOption[];
  catalogFields?: ProductCatalogFields;
}) {
  const [name, setName] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [stockLocal, setStockLocal] = useState(0);
  const [costCents, setCostCents] = useState(0);
  const [costGrossCents, setCostGrossCents] = useState(0);
  const [priceCents, setPriceCents] = useState(0);
  const [hasExpiration, setHasExpiration] = useState(false);
  const [expirationDate, setExpirationDate] = useState("");
  const [hasVat, setHasVat] = useState(true);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [fileLabel, setFileLabel] = useState("Ningún archivo seleccionado");

  const totalStock = stockLocal;
  const fmtStock = (n: number) =>
    n <= 0 ? "0" : formatQuantityInputGrouping(n);
  const categoryLabel =
    categories.find((c) => c.id === categoryId)?.name ?? "—";

  return (
    <form
      action={createProduct}
      className="space-y-6"
      onSubmit={(e) => {
        if (blockSubmitIfImageTooLarge(e.currentTarget)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="is_published" value="on" />

      <div className="grid gap-6 xl:grid-cols-3 xl:gap-8">
        <div className="space-y-6 xl:col-span-2">
          <section className={cardClass}>
            <h2 className={sectionTitle}>Información básica</h2>
            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="np-name" className={labelClass}>
                  Nombre del producto <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  id="np-name"
                  name="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre del producto"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="np-ref" className={labelClass}>
                  Referencia <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  id="np-ref"
                  name="reference"
                  required
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="REF-001"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="np-desc" className={labelClass}>
                  Descripción (opcional)
                </label>
                <textarea
                  id="np-desc"
                  name="description"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripción detallada del producto (opcional)"
                  className={inputClass}
                />
              </div>
              <div>
                <span className={labelClass}>Imagen (catálogo en línea, opcional)</span>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer">
                    <span className="rounded-lg border border-zinc-200/90 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700">
                      Seleccionar archivo
                    </span>
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
                        setFileLabel(f ? f.name : "Ningún archivo seleccionado");
                      }}
                    />
                  </label>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">{fileLabel}</span>
                </div>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  JPG, PNG o WebP. Máx. {MAX_PRODUCT_IMAGE_BYTES / (1024 * 1024)} MB.
                  Visible en el catálogo público.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {catalogFields.brand ? (
                <div>
                  <label htmlFor="np-brand" className={labelClass}>
                    Marca (opcional)
                  </label>
                  <input
                    id="np-brand"
                    name="brand"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Marca del producto"
                    className={inputClass}
                  />
                </div>
                ) : null}
                {catalogFields.category ? (
                <div>
                  <label htmlFor="np-cat" className={labelClass}>
                    Categoría (opcional)
                  </label>
                  <select
                    id="np-cat"
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
              {catalogFields.sizes || catalogFields.colors ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {catalogFields.sizes ? (
                <div className="sm:col-span-2">
                  <ProductSizeRows
                    initialRows={[{ value: "", unit: "ml" }]}
                  />
                </div>
                ) : null}
                {catalogFields.colors ? (
                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    Colores (opcional)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PRODUCT_COLOR_OPTIONS.map((color) => {
                      const checked = selectedColors.includes(color);
                      return (
                        <label
                          key={color}
                          className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                            checked
                              ? "border-[#3d5240] bg-[#eef3ee] text-[#3d5240] dark:border-emerald-700/80 dark:bg-emerald-950/45 dark:text-emerald-100"
                              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-500"
                          }`}
                        >
                          <input
                            type="checkbox"
                            name="colors"
                            value={color}
                            checked={checked}
                            onChange={(e) =>
                              setSelectedColors((prev) =>
                                e.target.checked
                                  ? [...prev, color]
                                  : prev.filter((c) => c !== color),
                              )
                            }
                            className="sr-only"
                          />
                          <span className={`size-3 rounded-full ${productColorSwatchClass(color)}`} />
                          {color}
                        </label>
                      );
                    })}
                  </div>
                </div>
                ) : null}
              </div>
              ) : null}
              {catalogFields.fragrances ? (
              <ProductFragranceRows
                initialRows={
                  [{ label: "", existingImagePath: null, previewUrl: null }] satisfies FragranceRowInitial[]
                }
              />
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
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
                    className="rounded border-zinc-300 accent-zinc-900 focus:ring-zinc-200/80 dark:border-zinc-600 dark:accent-zinc-100 dark:focus:ring-zinc-600/40"
                  />
                  Tiene fecha de vencimiento
                </label>
                <div className={!hasExpiration ? "pointer-events-none opacity-60" : ""}>
                  <label htmlFor="np-expiration" className={labelClass}>
                    Fecha de vencimiento
                  </label>
                  <AdminDateInput
                    id="np-expiration"
                    name="expiration_date"
                    value={expirationDate}
                    onChange={setExpirationDate}
                    required={false}
                  />
                </div>
                </>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    name="has_vat"
                    value="on"
                    checked={hasVat}
                    onChange={(e) => {
                      setHasVat(e.target.checked);
                    }}
                    className="rounded border-zinc-300 accent-zinc-900 focus:ring-zinc-200/80 dark:border-zinc-600 dark:accent-zinc-100 dark:focus:ring-zinc-600/40"
                  />
                  Maneja IVA
                </label>
                <div className={!hasVat ? "pointer-events-none opacity-60" : ""}>
                  <p className={`${labelClass} normal-case tracking-normal`}>
                    IVA sobre precio de venta
                  </p>
                  <p className="mt-1 text-sm leading-snug text-zinc-600 dark:text-zinc-400">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {SALE_VAT_PERCENT} %
                    </span>{" "}
                    (tipo general Colombia). El precio de venta es la base{" "}
                    <span className="font-medium">sin IVA</span>.
                  </p>
                  {hasVat ? (
                    <input type="hidden" name="vat_percent" value={String(SALE_VAT_PERCENT)} />
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className={cardClass}>
            <h2 className={sectionTitle}>Control de stock</h2>
            <div className="mt-5 max-w-xs">
              <div>
                <label htmlFor="np-sl" className={labelClass}>
                  Stock en la sucursal activa
                </label>
                <ProductQuantityInput
                  id="np-sl"
                  name="stock_local"
                  value={stockLocal}
                  onChange={setStockLocal}
                />
              </div>
            </div>
            <input type="hidden" name="stock_warehouse" value="0" />
            <div className="mt-4 rounded-lg border border-zinc-200/90 bg-white/60 px-4 py-3 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-200">
              Total inicial:{" "}
              <span className="font-medium tabular-nums">
                {fmtStock(totalStock)} unidades
              </span>{" "}
              en esta sucursal
            </div>
            <div className="mt-4 space-y-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              <p>
                El stock pertenece a la sucursal elegida en la barra superior.
              </p>
              <p>
                Puedes ajustar cantidades después desde la lista de productos. La asignación
                a estantes se habilita cuando hay stock en bodega.
              </p>
            </div>
          </section>
        </div>

        <div className="space-y-6 xl:sticky xl:top-24 xl:col-span-1 xl:self-start">
          <section className={cardClass}>
            <h2 className={sectionTitle}>Información financiera</h2>
            <div className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>
                    Costo (sin IVA) <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <ProductMoneyInput
                    name="cost_cents"
                    value={costCents}
                    onChange={setCostCents}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Costo con IVA</label>
                  <ProductMoneyInput
                    name="cost_gross_cents"
                    value={costGrossCents}
                    onChange={setCostGrossCents}
                    required={false}
                  />
                  <p className="mt-1.5 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                    Bruto en factura del proveedor (reportes de stock).
                  </p>
                </div>
              </div>
              <div>
                <label className={labelClass}>
                  Precio de venta <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <ProductMoneyInput
                  name="price_cents"
                  value={priceCents}
                  onChange={setPriceCents}
                  required
                />
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Si se puede vender por encima o por debajo de este precio lo
                define Configuración → Precios en la venta.
              </p>
            </div>
          </section>

          <section className={cardClass}>
            <h2 className={sectionTitle}>Resumen del producto</h2>
            <div className={summaryInset}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
                Producto
              </p>
              <dl className="mt-3 space-y-2 text-zinc-700 dark:text-zinc-300">
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500 dark:text-zinc-400">Nombre</dt>
                  <dd className="max-w-[60%] truncate text-right text-zinc-900 dark:text-zinc-100">
                    {name.trim() || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500 dark:text-zinc-400">Referencia</dt>
                  <dd className="font-mono text-xs text-zinc-900 dark:text-zinc-100">
                    {reference.trim() || "—"}
                  </dd>
                </div>
                {catalogFields.category ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500 dark:text-zinc-400">Categoría</dt>
                  <dd className="max-w-[55%] truncate text-right text-zinc-800 dark:text-zinc-100">
                    {categoryLabel}
                  </dd>
                </div>
                ) : null}
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500 dark:text-zinc-400">Stock sucursal</dt>
                  <dd className="tabular-nums text-zinc-900 dark:text-zinc-100">
                    {fmtStock(stockLocal)} unidades
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-t border-zinc-200/80 pt-2 dark:border-zinc-700/80">
                  <dt className="text-zinc-600 dark:text-zinc-400">Total</dt>
                  <dd className="tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                    {fmtStock(totalStock)} unidades
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-5 border-t border-zinc-200/70 pt-5 dark:border-zinc-800">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Precio de venta</p>
              <p className="mt-1 text-2xl font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                {formatCop(priceCents)}
              </p>
            </div>

            <ul className="mt-4 space-y-1.5 border-t border-zinc-200/70 pt-4 text-sm dark:border-zinc-800">
              <li className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Costo</span>
                <span className="tabular-nums text-zinc-900 dark:text-zinc-100">
                  {formatCop(costCents)}
                </span>
              </li>
              <li className="flex justify-between font-medium text-zinc-900 dark:text-zinc-100">
                <span>Precio venta</span>
                <span className="tabular-nums">{formatCop(priceCents)}</span>
              </li>
            </ul>

            <p className="mt-5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              Cuando confirmes, el producto quedará en el catálogo y podrás ajustar el
              stock después.
            </p>

            <AdminFormSubmitButton pendingLabel="Creando…">
              Crear producto
            </AdminFormSubmitButton>
          </section>
        </div>
      </div>
    </form>
  );
}

export function NewProductHeader() {
  return (
    <div className="mb-6 flex min-w-0 flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          <Link href="/admin/products" className="hover:text-zinc-800 dark:hover:text-zinc-200">
            Inventario
          </Link>
          <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">/</span>
          <span className="text-zinc-700 dark:text-zinc-300">Nuevo producto</span>
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-2xl md:text-3xl">
          Nuevo producto
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
          Registra un nuevo producto en el catálogo: datos, precio y stock en un solo lugar.
        </p>
      </div>
      <Link
        href="/admin/products"
        className="inline-flex size-10 shrink-0 items-center justify-center self-start rounded-lg border border-zinc-200/90 bg-white text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 sm:self-auto"
        aria-label="Volver al listado"
      >
        <span className="text-lg leading-none" aria-hidden>
          ←
        </span>
      </Link>
    </div>
  );
}
