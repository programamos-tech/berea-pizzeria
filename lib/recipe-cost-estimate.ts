import type { SupabaseClient } from "@supabase/supabase-js";
import {
  menuItemKindFromBomCount,
  type MenuItemKind,
} from "@/lib/menu-item-kind";

export type RecipeCostLineEstimate = {
  name: string;
  quantity: number;
  unit: string;
  unitCostCents: number | null;
  lineCostCents: number | null;
  missingCost: boolean;
  optional: boolean;
  skipped: boolean;
  note: string | null;
};

export type RecipeCostEstimate = {
  recipeId: string | null;
  recipeName: string | null;
  kind: MenuItemKind;
  /** Suma de líneas con costo conocido. */
  estimatedCostCents: number;
  /** true si alguna línea obligatoria no tiene costo o unidad incompatible. */
  isPartial: boolean;
  missingCostCount: number;
  lineCount: number;
  lines: RecipeCostLineEstimate[];
  variantCount: number;
};

type RecipeLineRow = {
  quantity: number | string | null;
  unit: string | null;
  is_optional: boolean | null;
  note: string | null;
  ingredient_id: string | null;
  component_recipe_id: string | null;
  ingredients: { name: string; unit: string; unit_cost_cents: number | null } | null;
};

/** Convierte cantidad de `fromUnit` a `toUnit` cuando es posible; si no, null. */
export function convertQuantity(
  qty: number,
  fromUnit: string,
  toUnit: string,
): number | null {
  const from = fromUnit.trim().toLowerCase();
  const to = toUnit.trim().toLowerCase();
  if (!Number.isFinite(qty)) return null;
  if (from === to) return qty;
  if (from === "al_gusto" || to === "al_gusto") return null;

  const toGrams: Record<string, number> = {
    g: 1,
    kg: 1000,
    lb: 453.59237,
    oz_weight: 28.3495231,
  };
  const toMl: Record<string, number> = {
    ml: 1,
    l: 1000,
    oz: 29.5735296,
  };

  if (from in toGrams && to in toGrams) {
    return (qty * toGrams[from]) / toGrams[to];
  }
  if (from in toMl && to in toMl) {
    return (qty * toMl[from]) / toMl[to];
  }
  return null;
}

function lineCostCents(
  quantity: number,
  lineUnit: string,
  ingredientUnit: string,
  unitCostCents: number | null,
): { cost: number | null; note: string | null } {
  if (unitCostCents == null || unitCostCents < 0) {
    return { cost: null, note: "Sin costo de insumo" };
  }
  if (quantity <= 0) {
    return { cost: 0, note: null };
  }
  const converted = convertQuantity(quantity, lineUnit, ingredientUnit);
  if (converted == null) {
    return {
      cost: null,
      note: `Unidad ${lineUnit} ≠ ${ingredientUnit}`,
    };
  }
  return {
    cost: Math.max(0, Math.round(converted * unitCostCents)),
    note: null,
  };
}

async function loadRecipeLines(
  supabase: SupabaseClient,
  recipeId: string,
): Promise<RecipeLineRow[]> {
  const { data, error } = await supabase
    .from("recipe_lines")
    .select(
      "quantity,unit,is_optional,note,ingredient_id,component_recipe_id,ingredients(name,unit,unit_cost_cents)",
    )
    .eq("recipe_id", recipeId)
    .order("sort_order", { ascending: true });
  if (error) {
    // Compat: columna unit_cost_cents aún no migrada
    const fallback = await supabase
      .from("recipe_lines")
      .select(
        "quantity,unit,is_optional,note,ingredient_id,component_recipe_id,ingredients(name,unit)",
      )
      .eq("recipe_id", recipeId)
      .order("sort_order", { ascending: true });
    if (fallback.error) {
      console.error("loadRecipeLines", error.message);
      return [];
    }
    return (fallback.data ?? []).map((row) => {
      const ing = row.ingredients as
        | { name: string; unit: string }
        | { name: string; unit: string }[]
        | null;
      const one = Array.isArray(ing) ? ing[0] : ing;
      return {
        quantity: row.quantity as number,
        unit: row.unit as string,
        is_optional: row.is_optional as boolean,
        note: row.note as string | null,
        ingredient_id: row.ingredient_id as string | null,
        component_recipe_id: row.component_recipe_id as string | null,
        ingredients: one
          ? { name: one.name, unit: one.unit, unit_cost_cents: null }
          : null,
      };
    });
  }
  return (data ?? []).map((row) => {
    const ing = row.ingredients as
      | { name: string; unit: string; unit_cost_cents: number | null }
      | { name: string; unit: string; unit_cost_cents: number | null }[]
      | null;
    const one = Array.isArray(ing) ? ing[0] : ing;
    return {
      quantity: row.quantity as number,
      unit: row.unit as string,
      is_optional: row.is_optional as boolean,
      note: row.note as string | null,
      ingredient_id: row.ingredient_id as string | null,
      component_recipe_id: row.component_recipe_id as string | null,
      ingredients: one
        ? {
            name: one.name,
            unit: one.unit,
            unit_cost_cents:
              one.unit_cost_cents == null
                ? null
                : Math.max(0, Math.floor(Number(one.unit_cost_cents))),
          }
        : null,
    };
  });
}

async function estimateRecipeBom(
  supabase: SupabaseClient,
  recipeId: string,
  depth = 0,
  seen: Set<string> = new Set(),
): Promise<{
  estimatedCostCents: number;
  missingCostCount: number;
  lineCount: number;
  lines: RecipeCostLineEstimate[];
}> {
  if (depth > 6 || seen.has(recipeId)) {
    return {
      estimatedCostCents: 0,
      missingCostCount: 0,
      lineCount: 0,
      lines: [],
    };
  }
  seen.add(recipeId);

  const rows = await loadRecipeLines(supabase, recipeId);
  let estimatedCostCents = 0;
  let missingCostCount = 0;
  const lines: RecipeCostLineEstimate[] = [];

  for (const row of rows) {
    const qty = Math.max(0, Number(row.quantity ?? 0));
    const unit = String(row.unit ?? "g");
    const optional = Boolean(row.is_optional);

    if (row.component_recipe_id) {
      const { data: comp } = await supabase
        .from("recipes")
        .select("id,name,yield_qty")
        .eq("id", row.component_recipe_id)
        .maybeSingle();
      const nested = await estimateRecipeBom(
        supabase,
        row.component_recipe_id,
        depth + 1,
        seen,
      );
      const yieldQty = Math.max(1, Number(comp?.yield_qty ?? 1));
      const unitBatchCost = nested.estimatedCostCents / yieldQty;
      const scaled =
        nested.estimatedCostCents > 0
          ? Math.max(0, Math.round(unitBatchCost * qty))
          : null;
      const missing =
        nested.missingCostCount > 0 ||
        (nested.lineCount > 0 && nested.estimatedCostCents <= 0);
      if (scaled != null) estimatedCostCents += scaled;
      if (missing && !optional) missingCostCount += 1;
      lines.push({
        name: comp?.name ? `Receta · ${comp.name}` : "Sub-receta",
        quantity: qty,
        unit,
        unitCostCents:
          nested.estimatedCostCents > 0
            ? Math.round(unitBatchCost)
            : null,
        lineCostCents: scaled,
        missingCost: missing,
        optional,
        skipped: false,
        note: missing ? "Costo parcial de sub-receta" : null,
      });
      continue;
    }

    const ing = row.ingredients;
    const name = ing?.name?.trim() || "Insumo";
    if (unit === "al_gusto" || (qty <= 0 && optional)) {
      lines.push({
        name,
        quantity: qty,
        unit,
        unitCostCents: ing?.unit_cost_cents ?? null,
        lineCostCents: 0,
        missingCost: false,
        optional,
        skipped: true,
        note: "Al gusto / sin cantidad — no suma",
      });
      continue;
    }

    const { cost, note } = lineCostCents(
      qty,
      unit,
      ing?.unit ?? unit,
      ing?.unit_cost_cents ?? null,
    );
    if (cost != null) estimatedCostCents += cost;
    const missing = cost == null;
    if (missing && !optional) missingCostCount += 1;
    lines.push({
      name,
      quantity: qty,
      unit,
      unitCostCents: ing?.unit_cost_cents ?? null,
      lineCostCents: cost,
      missingCost: missing,
      optional,
      skipped: false,
      note,
    });
  }

  return {
    estimatedCostCents,
    missingCostCount,
    lineCount: rows.length,
    lines,
  };
}

/**
 * Resuelve tipo + costo estimado para un producto del menú.
 * Usa `products.recipe_id` (variante por defecto) y cuenta BOM.
 */
export async function estimateProductMenuCost(
  supabase: SupabaseClient,
  productId: string,
  recipeId: string | null | undefined,
): Promise<RecipeCostEstimate> {
  let variantCount = 0;
  const { count } = await supabase
    .from("product_recipe_variants")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  variantCount = count ?? 0;

  if (!recipeId) {
    return {
      recipeId: null,
      recipeName: null,
      kind: "reventa",
      estimatedCostCents: 0,
      isPartial: false,
      missingCostCount: 0,
      lineCount: 0,
      lines: [],
      variantCount,
    };
  }

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id,name")
    .eq("id", recipeId)
    .maybeSingle();

  const bom = await estimateRecipeBom(supabase, recipeId);
  const kind = menuItemKindFromBomCount(bom.lineCount);

  return {
    recipeId,
    recipeName: recipe?.name ?? null,
    kind,
    estimatedCostCents: bom.estimatedCostCents,
    isPartial: kind === "elaborado" && bom.missingCostCount > 0,
    missingCostCount: bom.missingCostCount,
    lineCount: bom.lineCount,
    lines: bom.lines,
    variantCount,
  };
}

/** Batch: kind por product id a partir de recipe_id (conteo de líneas BOM). */
export async function fetchMenuItemKindsByProductIds(
  supabase: SupabaseClient,
  rows: { id: string; recipe_id?: string | null }[],
): Promise<Map<string, MenuItemKind>> {
  const map = new Map<string, MenuItemKind>();
  const recipeIds = [
    ...new Set(
      rows
        .map((r) => r.recipe_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  const countByRecipe = new Map<string, number>();
  if (recipeIds.length) {
    const { data, error } = await supabase
      .from("recipe_lines")
      .select("recipe_id")
      .in("recipe_id", recipeIds);
    if (error) {
      console.error("fetchMenuItemKindsByProductIds", error.message);
    } else {
      for (const row of data ?? []) {
        const rid = String(row.recipe_id);
        countByRecipe.set(rid, (countByRecipe.get(rid) ?? 0) + 1);
      }
    }
  }
  for (const row of rows) {
    const n = row.recipe_id ? (countByRecipe.get(row.recipe_id) ?? 0) : 0;
    map.set(row.id, menuItemKindFromBomCount(n));
  }
  return map;
}
