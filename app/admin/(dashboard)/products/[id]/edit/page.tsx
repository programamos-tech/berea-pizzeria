import { notFound } from "next/navigation";
import {
  EditProductForm,
  EditProductHeader,
} from "@/components/admin/EditProductForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateProduct } from "@/app/actions/admin/products";
import type { FragranceRowInitial } from "@/components/admin/ProductFragranceRows";
import type { SizeRowState } from "@/components/admin/ProductSizeRows";
import {
  normalizeSizeOptionsFromRow,
  SIZE_UNITS,
} from "@/lib/product-size-options";
import { storagePublicObjectUrl } from "@/lib/storage-public-url";
import { parseProductCatalogFields } from "@/lib/product-catalog-fields";
import { requireAdminPermission } from "@/lib/require-admin-permission";
import { SALE_VAT_PERCENT, tenantChargesVat } from "@/lib/product-vat-price";
import { fetchCurrentBranchInventoryMap } from "@/lib/branch-inventory";
import { estimateProductMenuCost } from "@/lib/recipe-cost-estimate";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type ProductRow = {
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
  is_published: boolean;
  category_id?: string | null;
  size_options?: unknown;
  size_value?: number | null;
  size_unit?: string | null;
  has_expiration?: boolean | null;
  expiration_date?: string | null;
  colors?: string[] | null;
  fragrance_options?: string[] | null;
  fragrance_option_images?: Record<string, unknown> | null;
  has_vat?: boolean | null;
  vat_percent?: number | null;
  recipe_id?: string | null;
};

function fragranceRowsForEditForm(p: ProductRow): FragranceRowInitial[] {
  const imgMap =
    p.fragrance_option_images &&
    typeof p.fragrance_option_images === "object" &&
    !Array.isArray(p.fragrance_option_images)
      ? (p.fragrance_option_images as Record<string, string>)
      : {};
  const lines = Array.isArray(p.fragrance_options)
    ? p.fragrance_options.filter(
        (x): x is string => typeof x === "string" && x.trim().length > 0,
      )
    : [];
  if (lines.length === 0) {
    return [{ label: "", existingImagePath: null, previewUrl: null }];
  }
  return lines.map((label) => {
    const raw = imgMap[label];
    const path =
      typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
    return {
      label,
      existingImagePath: path,
      previewUrl: path ? storagePublicObjectUrl(path) : null,
    };
  });
}

function sizeRowsForEditForm(p: ProductRow): SizeRowState[] {
  const opts = normalizeSizeOptionsFromRow(p);
  if (opts.length === 0) return [{ value: "", unit: "ml" }];
  return opts.map((o) => {
    const u = o.unit.trim().toLowerCase();
    const unit = (SIZE_UNITS as readonly string[]).includes(u)
      ? (u as SizeRowState["unit"])
      : "unidad";
    return { value: String(o.value), unit };
  });
}

function shortSku(id: string) {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export default async function EditProductPage({ params, searchParams }: Props) {
  const perm = await requireAdminPermission("productos_editar");
  const { id } = await params;
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;

  const supabase = await createSupabaseServerClient();
  const [{ data: product }, { data: categories }, { data: tenant }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("categories")
      .select("id,name")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("tenants")
      .select("storefront_config")
      .eq("id", perm.tenantId)
      .maybeSingle(),
  ]);

  if (!product) notFound();

  const p = product as ProductRow;
  const cats = categories ?? [];
  const categoryId = p.category_id ?? "";
  const inventory = await fetchCurrentBranchInventoryMap(supabase, [id]);
  const stockLocal = inventory.get(id) ?? 0;
  const referenceLabel =
    (p.reference ?? "").trim() || shortSku(id);

  const img = storagePublicObjectUrl(p.image_path);
  const boundUpdate = updateProduct.bind(null, id);
  const menuCost = await estimateProductMenuCost(
    supabase,
    id,
    p.recipe_id ?? null,
  );

  return (
    <div className="flex w-full min-w-0 max-w-none flex-col gap-4">
      <EditProductHeader
        productId={id}
        productName={p.name}
        referenceLabel={referenceLabel}
        stockLocal={stockLocal}
        menuKind={menuCost.kind}
      />

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error === "rls"
            ? "No tienes permiso para actualizar. Verifica tu perfil admin."
            : error === "reference"
              ? "La referencia es obligatoria."
              : error === "name"
                ? "El nombre es obligatorio."
                : "Error al guardar. Revisa los datos o los logs del servidor."}
        </p>
      ) : null}

      <EditProductForm
        productId={id}
        formAction={boundUpdate}
        categories={cats}
        currentImageUrl={img}
        catalogFields={parseProductCatalogFields(tenant?.storefront_config)}
        chargeVat={tenantChargesVat(tenant?.storefront_config)}
        menuKind={menuCost.kind}
        recipeCost={
          menuCost.kind === "elaborado"
            ? {
                estimatedCostCents: menuCost.estimatedCostCents,
                isPartial: menuCost.isPartial,
                missingCostCount: menuCost.missingCostCount,
                lineCount: menuCost.lineCount,
                recipeName: menuCost.recipeName,
                variantCount: menuCost.variantCount,
              }
            : null
        }
        initial={{
          name: p.name,
          reference: p.reference ?? "",
          description: p.description ?? "",
          brand: p.brand ?? "",
          categoryId,
          priceCents: p.price_cents,
          costCents: p.cost_cents ?? 0,
          costGrossCents: p.cost_gross_cents ?? 0,
          stockLocal,
          stockWarehouse: 0,
          isPublished: p.is_published === true,
          sizeRows: sizeRowsForEditForm(p),
          hasExpiration: p.has_expiration === true,
          expirationDate: p.expiration_date ?? "",
          hasVat: p.has_vat ?? true,
          vatPercent:
            p.has_vat === false ? null : (p.vat_percent ?? SALE_VAT_PERCENT),
          colors: Array.isArray(p.colors) ? p.colors : [],
          fragranceRows: fragranceRowsForEditForm(p),
        }}
      />
    </div>
  );
}
