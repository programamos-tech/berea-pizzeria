"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  isRecipeKind,
  normalizeCategoryKey,
  parseRecipeBomLinesFromFormData,
  slugifyRecipeName,
  type RecipeBomLineInput,
} from "@/lib/recipe-form";
import { requireAdminPermission } from "@/lib/require-admin-permission";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function uniqueRecipeSlug(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tenantId: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  const root = base || "receta";
  for (let i = 0; i < 40; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;
    let q = supabase
      .from("recipes")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("slug", slug);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q.maybeSingle();
    if (!data) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

async function replaceRecipeLines(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tenantId: string,
  recipeId: string,
  lines: RecipeBomLineInput[],
) {
  const { error: delErr } = await supabase
    .from("recipe_lines")
    .delete()
    .eq("recipe_id", recipeId);
  if (delErr) {
    console.error("replaceRecipeLines delete", delErr.message);
    return delErr;
  }
  if (lines.length === 0) return null;

  const rows = lines.map((line) => ({
    tenant_id: tenantId,
    recipe_id: recipeId,
    ingredient_id: line.ingredientId,
    component_recipe_id: line.componentRecipeId,
    quantity: line.quantity,
    unit: line.unit,
    is_optional: line.isOptional,
    note: line.note,
    sort_order: line.sortOrder,
  }));

  const { error: insErr } = await supabase.from("recipe_lines").insert(rows);
  if (insErr) console.error("replaceRecipeLines insert", insErr.message);
  return insErr;
}

function parseRecipeHeader(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "menu").trim().toLowerCase();
  const category_key = normalizeCategoryKey(
    String(formData.get("category_key") ?? ""),
  );
  const yield_qty = Number(
    String(formData.get("yield_qty") ?? "1").replace(",", "."),
  );
  const yield_unit = String(formData.get("yield_unit") ?? "porcion")
    .trim()
    .slice(0, 40) || "porcion";
  const procedure_text = String(formData.get("procedure_text") ?? "")
    .trim()
    .slice(0, 8000);
  const is_active = formData.get("is_active") === "on";
  return {
    name,
    kindRaw,
    category_key,
    yield_qty: Number.isFinite(yield_qty) && yield_qty > 0 ? yield_qty : 1,
    yield_unit,
    procedure_text,
    is_active,
  };
}

export async function createRecipe(formData: FormData) {
  const session = await requireAdminPermission("productos_crear");
  const supabase = await createSupabaseServerClient();
  const header = parseRecipeHeader(formData);
  const lines = parseRecipeBomLinesFromFormData(formData);

  if (!header.name || header.name.length > 160) {
    redirect("/admin/recipes/new?error=name");
  }
  if (!isRecipeKind(header.kindRaw)) {
    redirect("/admin/recipes/new?error=kind");
  }

  const slug = await uniqueRecipeSlug(
    supabase,
    session.tenantId,
    slugifyRecipeName(header.name),
  );

  const { data, error } = await supabase
    .from("recipes")
    .insert({
      tenant_id: session.tenantId,
      name: header.name,
      slug,
      kind: header.kindRaw,
      category_key: header.category_key,
      yield_qty: header.yield_qty,
      yield_unit: header.yield_unit,
      procedure_text: header.procedure_text,
      is_active: true,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.error("createRecipe", error?.message);
    if (error?.code === "23505") redirect("/admin/recipes/new?error=duplicate");
    redirect("/admin/recipes/new?error=db");
  }

  const lineErr = await replaceRecipeLines(
    supabase,
    session.tenantId,
    data.id,
    lines,
  );
  if (lineErr) {
    redirect(`/admin/recipes/${data.id}/edit?error=lines`);
  }

  revalidatePath("/admin/recipes");
  redirect(`/admin/recipes/${data.id}?saved=1`);
}

export async function updateRecipe(recipeId: string, formData: FormData) {
  const session = await requireAdminPermission("productos_editar");
  const supabase = await createSupabaseServerClient();
  const id = String(recipeId ?? "").trim();
  if (!id) redirect("/admin/recipes");

  const header = parseRecipeHeader(formData);
  const lines = parseRecipeBomLinesFromFormData(formData);

  if (!header.name || header.name.length > 160) {
    redirect(`/admin/recipes/${id}/edit?error=name`);
  }
  if (!isRecipeKind(header.kindRaw)) {
    redirect(`/admin/recipes/${id}/edit?error=kind`);
  }

  const { data: existing } = await supabase
    .from("recipes")
    .select("id, name, slug")
    .eq("id", id)
    .maybeSingle();
  if (!existing) redirect("/admin/recipes");

  const slug =
    existing.name === header.name
      ? String(existing.slug)
      : await uniqueRecipeSlug(
          supabase,
          session.tenantId,
          slugifyRecipeName(header.name),
          id,
        );

  const { error } = await supabase
    .from("recipes")
    .update({
      name: header.name,
      slug,
      kind: header.kindRaw,
      category_key: header.category_key,
      yield_qty: header.yield_qty,
      yield_unit: header.yield_unit,
      procedure_text: header.procedure_text,
      is_active: header.is_active,
    })
    .eq("id", id);

  if (error) {
    console.error("updateRecipe", error.message);
    redirect(`/admin/recipes/${id}/edit?error=db`);
  }

  const lineErr = await replaceRecipeLines(
    supabase,
    session.tenantId,
    id,
    lines,
  );
  if (lineErr) {
    redirect(`/admin/recipes/${id}/edit?error=lines`);
  }

  revalidatePath("/admin/recipes");
  revalidatePath(`/admin/recipes/${id}`);
  revalidatePath(`/admin/recipes/${id}/edit`);
  redirect(`/admin/recipes/${id}?saved=1`);
}

export async function deleteRecipe(recipeId: string) {
  await requireAdminPermission("productos_editar");
  const supabase = await createSupabaseServerClient();
  const id = String(recipeId ?? "").trim();
  if (!id) redirect("/admin/recipes");

  const [{ count: productCount }, { count: variantCount }, { count: asComponent }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("recipe_id", id),
      supabase
        .from("product_recipe_variants")
        .select("id", { count: "exact", head: true })
        .eq("recipe_id", id),
      supabase
        .from("recipe_lines")
        .select("id", { count: "exact", head: true })
        .eq("component_recipe_id", id),
    ]);

  const products = productCount ?? 0;
  const variants = variantCount ?? 0;
  const components = asComponent ?? 0;

  if (products > 0 || variants > 0) {
    redirect(
      `/admin/recipes/${id}?error=in_use&products=${products}&variants=${variants}`,
    );
  }
  if (components > 0) {
    redirect(`/admin/recipes/${id}?error=as_component&n=${components}`);
  }

  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) {
    console.error("deleteRecipe", error.message);
    if (/foreign key|restrict/i.test(error.message)) {
      redirect(`/admin/recipes/${id}?error=in_use`);
    }
    redirect(`/admin/recipes/${id}?error=db`);
  }

  revalidatePath("/admin/recipes");
  redirect("/admin/recipes?deleted=1");
}
