import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminIngredientRow = {
  id: string;
  name: string;
  slug: string;
  unit: string;
  notes: string;
  is_active: boolean;
};

export type AdminRecipeRow = {
  id: string;
  name: string;
  slug: string;
  kind: string;
  category_key: string;
  yield_qty: number;
  yield_unit: string;
  procedure_text: string;
  is_active: boolean;
  lines_count: number;
};

export async function fetchAdminIngredients(
  supabase: SupabaseClient,
): Promise<AdminIngredientRow[]> {
  const { data, error } = await supabase
    .from("ingredients")
    .select("id,name,slug,unit,notes,is_active")
    .order("name", { ascending: true });
  if (error) {
    console.error("fetchAdminIngredients", error.message);
    return [];
  }
  return (data ?? []) as AdminIngredientRow[];
}

export async function fetchAdminRecipes(
  supabase: SupabaseClient,
): Promise<AdminRecipeRow[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select(
      "id,name,slug,kind,category_key,yield_qty,yield_unit,procedure_text,is_active",
    )
    .order("name", { ascending: true });
  if (error) {
    console.error("fetchAdminRecipes", error.message);
    return [];
  }

  const ids = (data ?? []).map((r) => String(r.id));
  const countByRecipe = new Map<string, number>();
  if (ids.length) {
    const { data: lineRows, error: lineErr } = await supabase
      .from("recipe_lines")
      .select("recipe_id")
      .in("recipe_id", ids);
    if (lineErr) {
      console.error("fetchAdminRecipes lines", lineErr.message);
    } else {
      for (const row of lineRows ?? []) {
        const rid = String(row.recipe_id);
        countByRecipe.set(rid, (countByRecipe.get(rid) ?? 0) + 1);
      }
    }
  }

  const rows = (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    kind: String(row.kind),
    category_key: String(row.category_key),
    yield_qty: Number(row.yield_qty),
    yield_unit: String(row.yield_unit),
    procedure_text: String(row.procedure_text ?? ""),
    is_active: Boolean(row.is_active),
    lines_count: countByRecipe.get(String(row.id)) ?? 0,
  }));

  rows.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    if (a.category_key !== b.category_key) {
      return a.category_key.localeCompare(b.category_key);
    }
    return a.name.localeCompare(b.name, "es");
  });
  return rows;
}

export async function fetchAdminRecipeDetail(
  supabase: SupabaseClient,
  id: string,
) {
  const { data: recipe, error } = await supabase
    .from("recipes")
    .select(
      "id,name,slug,kind,category_key,yield_qty,yield_unit,procedure_text,is_active",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !recipe) return null;

  const { data: lines } = await supabase
    .from("recipe_lines")
    .select(
      "id,quantity,unit,is_optional,note,sort_order,ingredient_id,component_recipe_id",
    )
    .eq("recipe_id", id)
    .order("sort_order", { ascending: true });

  const ingIds = [
    ...new Set(
      (lines ?? [])
        .map((l) => l.ingredient_id as string | null)
        .filter((x): x is string => Boolean(x)),
    ),
  ];
  const compIds = [
    ...new Set(
      (lines ?? [])
        .map((l) => l.component_recipe_id as string | null)
        .filter((x): x is string => Boolean(x)),
    ),
  ];

  const [{ data: ings }, { data: comps }] = await Promise.all([
    ingIds.length
      ? supabase.from("ingredients").select("id,name,unit").in("id", ingIds)
      : Promise.resolve({ data: [] as { id: string; name: string; unit: string }[] }),
    compIds.length
      ? supabase.from("recipes").select("id,name,slug").in("id", compIds)
      : Promise.resolve({ data: [] as { id: string; name: string; slug: string }[] }),
  ]);

  const ingMap = new Map((ings ?? []).map((i) => [i.id, i]));
  const compMap = new Map((comps ?? []).map((c) => [c.id, c]));

  const enriched = (lines ?? []).map((line) => ({
    ...line,
    ingredient_name: line.ingredient_id
      ? ingMap.get(line.ingredient_id as string)?.name ?? "—"
      : null,
    component_name: line.component_recipe_id
      ? compMap.get(line.component_recipe_id as string)?.name ?? "—"
      : null,
  }));

  return { recipe, lines: enriched };
}
