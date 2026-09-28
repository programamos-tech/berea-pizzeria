import type { SupabaseClient } from "@supabase/supabase-js";
import { adminProductsNameReferenceOrIlikeFilter } from "@/lib/admin-product-search-filter";

type ListOpts = {
  q: string;
  status: string;
  categoryId: string;
  lowStockMax: number;
  /** 1-based */
  page: number;
  pageSize: number;
};

function isRetriableSelectError(err: { message?: string; code?: string } | null) {
  const m = err?.message ?? "";
  return (
    m.includes("schema cache") ||
    m.includes("Could not find") ||
    m.includes("Could not find a relationship") ||
    /column .* does not exist/i.test(m) ||
    (/column/i.test(m) && /reference|cost_cents|category_id|stock_warehouse|stock_local|categories|has_vat|vat_percent/i.test(m))
  );
}

/**
 * Select strings from richest schema → minimal (init-only).
 * Plain `string[]` (not `as const`) avoids supabase-js union explosion (TS2590).
 */
const PRODUCT_SELECT_ATTEMPTS: readonly string[] = [
  "id,name,reference,price_cents,cost_cents,cost_gross_cents,has_vat,vat_percent,stock_quantity,stock_warehouse,stock_local,is_published,image_path,created_at,category_id,recipe_id,categories(id,name)",
  "id,name,reference,price_cents,cost_cents,cost_gross_cents,has_vat,vat_percent,stock_quantity,stock_warehouse,stock_local,is_published,image_path,created_at,category_id,recipe_id",
  "id,name,reference,price_cents,cost_cents,cost_gross_cents,has_vat,vat_percent,stock_quantity,stock_warehouse,stock_local,is_published,image_path,created_at,category_id,categories(id,name)",
  "id,name,reference,price_cents,cost_cents,cost_gross_cents,has_vat,vat_percent,stock_quantity,stock_warehouse,stock_local,is_published,image_path,created_at,category_id",
  "id,name,reference,price_cents,has_vat,vat_percent,stock_quantity,stock_warehouse,stock_local,is_published,image_path,created_at,category_id,categories(id,name)",
  "id,name,reference,price_cents,has_vat,vat_percent,stock_quantity,stock_warehouse,stock_local,is_published,image_path,created_at,category_id",
  "id,name,price_cents,has_vat,vat_percent,stock_quantity,stock_warehouse,stock_local,is_published,image_path,created_at,category_id,categories(id,name)",
  "id,name,price_cents,has_vat,vat_percent,stock_quantity,stock_warehouse,stock_local,is_published,image_path,created_at,category_id",
  "id,name,reference,price_cents,has_vat,vat_percent,stock_quantity,is_published,image_path,created_at,category_id,categories(id,name)",
  "id,name,price_cents,has_vat,vat_percent,stock_quantity,is_published,image_path,created_at,category_id,categories(id,name)",
  "id,name,price_cents,has_vat,vat_percent,stock_quantity,is_published,image_path,created_at,category_id",
  "id,name,price_cents,has_vat,vat_percent,stock_quantity,is_published,image_path,created_at",
];

export async function fetchAdminProductsList(
  supabase: SupabaseClient,
  opts: ListOpts,
): Promise<{
  list: unknown[];
  error: { message?: string; code?: string } | null;
  usedFallbackSelect: boolean;
  totalCount: number;
}> {
  const { q, status, categoryId, lowStockMax, page, pageSize } = opts;
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.min(100, Math.max(10, Math.floor(pageSize)));
  const from = (safePage - 1) * safeSize;
  const to = from + safeSize - 1;
  let stockFilteredIds: string[] | null = null;
  if (status === "low" || status === "out") {
    const { data: stockRows, error: stockError } = await supabase.rpc(
      "current_branch_inventory",
      { p_product_ids: null },
    );
    if (stockError) {
      return {
        list: [],
        error: stockError,
        usedFallbackSelect: false,
        totalCount: 0,
      };
    }
    stockFilteredIds = (stockRows ?? [])
      .filter((row: { quantity?: number }) => {
        const quantity = Math.max(0, Math.floor(Number(row.quantity ?? 0)));
        return status === "out"
          ? quantity === 0
          : quantity > 0 && quantity <= lowStockMax;
      })
      .map((row: { product_id: string }) => String(row.product_id));
    if (!stockFilteredIds || stockFilteredIds.length === 0) {
      return {
        list: [],
        error: null,
        usedFallbackSelect: false,
        totalCount: 0,
      };
    }
  }

  for (let i = 0; i < PRODUCT_SELECT_ATTEMPTS.length; i++) {
    const sel = PRODUCT_SELECT_ATTEMPTS[i]!;
    if (categoryId && !sel.includes("category_id")) {
      continue;
    }

    let query = supabase.from("products").select(sel, { count: "estimated" });

    // Listar por código de referencia ascendente (01, 02, …).
    if (sel.includes("reference")) {
      query = query
        .order("reference", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
    } else {
      query = query.order("created_at", { ascending: true });
    }

    query = query.range(from, to);

    if (q) {
      const qt = q.trim();
      if (qt) {
        if (sel.includes("reference")) {
          query = query.or(adminProductsNameReferenceOrIlikeFilter(qt));
        } else {
          query = query.ilike("name", `%${qt}%`);
        }
      }
    }
    if (categoryId && sel.includes("category_id")) {
      query = query.eq("category_id", categoryId);
    }
    if (stockFilteredIds) query = query.in("id", stockFilteredIds);
    switch (status) {
      case "active":
        query = query.eq("is_published", true);
        break;
      case "draft":
        query = query.eq("is_published", false);
        break;
      case "low":
        break;
      case "out":
        break;
      default:
        break;
    }

    const { data, error, count } = await query;

    if (!error) {
      return {
        list: data ?? [],
        error: null,
        usedFallbackSelect: i > 0,
        totalCount: count ?? 0,
      };
    }

    if (!isRetriableSelectError(error)) {
      return {
        list: [],
        error,
        usedFallbackSelect: false,
        totalCount: 0,
      };
    }
  }

  return {
    list: [],
    error: { message: "No compatible product schema found" },
    usedFallbackSelect: false,
    totalCount: 0,
  };
}

export async function fetchAdminCategoriesList(supabase: SupabaseClient): Promise<
  { id: string; name: string }[]
> {
  const { data, error } = await supabase
    .from("categories")
    .select("id,name")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return [];
  }
  return data ?? [];
}

export type AdminCategoryManageRow = {
  id: string;
  name: string;
  icon_key: string | null;
  listing_hero_image_path: string | null;
  listing_hero_alt_text: string | null;
};

/** Listado completo para la vista/modal de gestión de categorías (orden en BD por sort_order + nombre). */
export async function fetchAdminCategoriesManageList(supabase: SupabaseClient): Promise<{
  list: AdminCategoryManageRow[];
  error: boolean;
}> {
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,icon_key,listing_hero_image_path,listing_hero_alt_text")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  return {
    list: (data ?? []) as AdminCategoryManageRow[],
    error: !!error,
  };
}
