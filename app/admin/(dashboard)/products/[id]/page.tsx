import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { AdminProductDetailToolbar } from "@/components/admin/AdminProductDetailToolbar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatCop, formatQuantityInputGrouping } from "@/lib/money";
import {
  formatSizeOption,
  normalizeSizeOptionsFromRow,
} from "@/lib/product-size-options";
import {
  saleVatPercentLabel,
  unitPriceGrossCents,
  unitPriceNetCents,
} from "@/lib/product-vat-price";
import {
  shouldUnoptimizeStorageImageUrl,
  storagePublicObjectUrl,
} from "@/lib/storage-public-url";
import { fetchCurrentBranchInventoryMap } from "@/lib/branch-inventory";
import { loadAdminPermissions } from "@/lib/load-admin-permissions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function shortSku(id: string) {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function fmtQty(n: number) {
  return n <= 0 ? "0" : formatQuantityInputGrouping(n);
}

const labelClass =
  "text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500";

const th =
  "pb-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500";

const metaSep = "text-zinc-300 dark:text-zinc-600";
const metaText = "text-zinc-700 dark:text-zinc-300";

export default async function AdminProductDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!product) notFound();
  const [inventory, perm] = await Promise.all([
    fetchCurrentBranchInventoryMap(supabase, [id]),
    loadAdminPermissions(),
  ]);

  const raw = product as Record<string, unknown> & {
    id: string;
    name: string;
    description: string;
    reference?: string;
    brand?: string;
    price_cents: number;
    cost_cents?: number;
    cost_gross_cents?: number;
    stock_warehouse?: number;
    stock_local?: number;
    stock_quantity: number;
    image_path: string | null;
    category_id?: string | null;
    size_options?: unknown;
    size_value?: number | null;
    size_unit?: string | null;
    has_expiration?: boolean | null;
    expiration_date?: string | null;
    fragrance_options?: string[] | null;
    has_vat?: boolean | null;
    vat_percent?: number | null;
    is_published?: boolean | null;
  };

  let categoryName = "Sin categoría";
  if (raw.category_id) {
    const { data: cat } = await supabase
      .from("categories")
      .select("name")
      .eq("id", raw.category_id)
      .maybeSingle();
    if (cat?.name) categoryName = cat.name;
  }

  const brand = (raw.brand && String(raw.brand).trim()) || "—";
  const reference =
    (raw.reference && String(raw.reference).trim()) || shortSku(raw.id);
  const cost = Number(raw.cost_cents ?? 0);
  const costGross = Number(raw.cost_gross_cents ?? 0);
  const price = Number(raw.price_cents ?? 0);
  const priceNet = unitPriceNetCents(price);
  const priceGross = unitPriceGrossCents(price, raw.has_vat, raw.vat_percent);
  const stockL = inventory.get(id) ?? 0;
  const stockTotal = stockL;
  const sizeOptions = normalizeSizeOptionsFromRow({
    size_options: raw.size_options,
    size_value: raw.size_value,
    size_unit: raw.size_unit,
  });
  const sizeLabel =
    sizeOptions.length > 0
      ? sizeOptions.map(formatSizeOption).join(", ")
      : "—";
  const expirationLabel = raw.has_expiration
    ? raw.expiration_date || "Requiere fecha de lote"
    : "No aplica";
  const fragranceLabel =
    Array.isArray(raw.fragrance_options) && raw.fragrance_options.length > 0
      ? raw.fragrance_options.join(", ")
      : "—";
  const vatLabel = raw.has_vat
    ? `${String(saleVatPercentLabel(true) ?? 0).replace(/\.0+$/, "")}%`
    : "No";

  const plataStock = cost * stockTotal;
  const margenBruto = Math.max(0, price - cost) * stockTotal;
  const margenPct =
    price > 0 ? Math.round(((price - cost) / price) * 100) : 0;
  const unitMargin = Math.max(0, price - cost);
  const salePrice = raw.has_vat ? priceGross : priceNet;

  const img = storagePublicObjectUrl(raw.image_path);
  const desc =
    (raw.description && String(raw.description).trim()) ||
    "Sin descripción cargada.";

  const crumb =
    raw.name.trim().length > 40
      ? `${raw.name.trim().slice(0, 39)}…`
      : raw.name.trim();

  return (
    <div className="flex w-full min-w-0 max-w-none flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-2 gap-y-2">
        <div className="min-w-0">
          <p className="text-[11px] text-zinc-500">
            <Link
              href="/admin/products"
              className="hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Menú
            </Link>
            <span className="mx-1.5 text-zinc-400">/</span>
            {crumb}
          </p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-2xl">
            {raw.name}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-zinc-500">
            <span className={`font-mono tabular-nums ${metaText}`}>
              {reference}
            </span>
            <span className={metaSep} aria-hidden>
              ·
            </span>
            <span className={metaText}>{categoryName}</span>
            <span className={metaSep} aria-hidden>
              ·
            </span>
            <span className={metaText}>{brand}</span>
            {sizeLabel !== "—" ? (
              <>
                <span className={metaSep} aria-hidden>
                  ·
                </span>
                <span className={metaText}>{sizeLabel}</span>
              </>
            ) : null}
          </p>
        </div>
        <AdminProductDetailToolbar
          productId={id}
          productName={raw.name}
          referenceLabel={reference}
          stockLocal={Math.max(0, Math.floor(stockL))}
        />
      </header>

      <div className="flex flex-col gap-6 border-t border-zinc-200/70 pt-4 dark:border-zinc-800 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:items-start lg:gap-8">
        <section className="min-w-0 space-y-6">
          <div className="flex gap-4">
            {img ? (
              <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 sm:size-20">
                <Image
                  src={img}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="80px"
                  unoptimized={shouldUnoptimizeStorageImageUrl(img)}
                />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className={labelClass}>Descripción</p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {desc}
              </p>
            </div>
          </div>

          <div className="max-h-[min(52dvh,28rem)] overflow-x-auto overflow-y-auto lg:max-h-none">
            <table className="min-w-full text-left text-[13px] leading-snug sm:text-sm">
              <thead className="sticky top-0 z-[1] bg-white dark:bg-zinc-950">
                <tr className="border-b border-zinc-200/70 dark:border-zinc-800">
                  <th className={th}>Código</th>
                  <th className={th}>Categoría</th>
                  <th className={th}>Marca</th>
                  <th className={th}>Tamaño</th>
                  <th className={th}>Vencimiento</th>
                  <th className={th}>Fragancias</th>
                  <th className={th}>IVA</th>
                  <th className={`${th} pr-0`}>Publicado</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-zinc-100/80 dark:border-zinc-800/80">
                  <td className="whitespace-nowrap py-2.5 pr-4 align-middle font-mono text-[13px] text-zinc-800 dark:text-zinc-200">
                    {reference}
                  </td>
                  <td className="py-2.5 pr-4 align-middle text-zinc-800 dark:text-zinc-200">
                    {categoryName}
                  </td>
                  <td className="py-2.5 pr-4 align-middle text-zinc-800 dark:text-zinc-200">
                    {brand}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-4 align-middle text-zinc-800 dark:text-zinc-200">
                    {sizeLabel}
                  </td>
                  <td className="py-2.5 pr-4 align-middle text-zinc-800 dark:text-zinc-200">
                    {expirationLabel}
                  </td>
                  <td className="max-w-[12rem] py-2.5 pr-4 align-middle text-zinc-800 dark:text-zinc-200">
                    {fragranceLabel}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-4 align-middle tabular-nums text-zinc-800 dark:text-zinc-200">
                    {vatLabel}
                  </td>
                  <td className="whitespace-nowrap py-2.5 align-middle text-zinc-800 dark:text-zinc-200">
                    {raw.is_published ? "Sí" : "No"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <aside className="shrink-0 space-y-5 border-t border-zinc-200/70 pt-4 dark:border-zinc-800 lg:sticky lg:top-3 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0 dark:lg:border-zinc-800">
          <div>
            <p className={labelClass}>Precio de venta</p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
              {formatCop(salePrice)}
            </p>
            {raw.has_vat ? (
              <p className="mt-1 text-sm tabular-nums text-zinc-500">
                {formatCop(priceNet)} sin IVA
              </p>
            ) : null}
          </div>

          <div>
            <p className={labelClass}>Stock</p>
            <div className="mt-1.5 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">
                  {perm?.branchContext?.active.name ?? "Sucursal"}
                </span>
                <span className="tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                  {fmtQty(stockL)}
                </span>
              </div>
              <div className="flex justify-between gap-3 border-t border-zinc-200/70 pt-1.5 dark:border-zinc-800">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Total
                </span>
                <span className="tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
                  {fmtQty(stockTotal)}
                </span>
              </div>
            </div>
          </div>

          <div>
            <p className={labelClass}>Costo</p>
            <p className="mt-1.5 text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
              {formatCop(cost)}
            </p>
            {costGross > 0 && costGross !== cost ? (
              <p className="mt-0.5 text-sm tabular-nums text-zinc-500">
                {formatCop(costGross)} con IVA
              </p>
            ) : null}
          </div>

          <div>
            <p className={labelClass}>Margen</p>
            <p className="mt-1.5 text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
              {margenPct}% · {formatCop(unitMargin)} / und.
            </p>
            <div className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">Valor stock</span>
                <span className="tabular-nums text-zinc-800 dark:text-zinc-200">
                  {formatCop(plataStock)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">Margen stock</span>
                <span className="tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                  {formatCop(margenBruto)}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
