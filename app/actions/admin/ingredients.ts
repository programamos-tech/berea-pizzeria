"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  isIngredientCategoryKey,
  normalizeIngredientCategoryKey,
} from "@/lib/ingredient-categories";
import {
  isIngredientUnit,
  slugifyIngredientName,
} from "@/lib/ingredient-units";
import { requireAdminPermission } from "@/lib/require-admin-permission";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function parseCategoryKey(raw: FormDataEntryValue | null): string {
  const key = normalizeIngredientCategoryKey(String(raw ?? ""));
  return isIngredientCategoryKey(key) ? key : "otros";
}

function parseQty(raw: FormDataEntryValue | null): number | null {
  const n = Number(String(raw ?? "").replace(",", ".").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 10000) / 10000;
}

function parseOptionalCostCents(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Math.floor(Number(digits));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export type IngredientStockEntryResult =
  | { ok: true; stockQty: number }
  | { ok: false; error: string };

async function uniqueIngredientSlug(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tenantId: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  const root = base || "insumo";
  for (let i = 0; i < 40; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;
    let q = supabase
      .from("ingredients")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("slug", slug);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q.maybeSingle();
    if (!data) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/** Entrada de compra / ajuste positivo de stock de un insumo. */
export async function addIngredientStockEntry(
  formData: FormData,
): Promise<IngredientStockEntryResult> {
  const session = await requireAdminPermission("stock_actualizar");
  const ingredientId = String(formData.get("ingredient_id") ?? "").trim();
  const qty = parseQty(formData.get("quantity"));
  const noteRaw = String(formData.get("note") ?? "").trim().slice(0, 240);
  const totalCostPesos = parseOptionalCostCents(
    formData.get("total_cost_cents"),
  );
  let unitCostCents = parseOptionalCostCents(formData.get("unit_cost_cents"));
  const kindRaw = String(formData.get("kind") ?? "purchase");
  const kind = kindRaw === "adjust" ? "adjust" : "purchase";

  if (!ingredientId) return { ok: false, error: "Insumo inválido." };
  if (qty == null) return { ok: false, error: "Indicá una cantidad mayor a 0." };

  // Preferencia: valor total ÷ cantidad → costo unitario para recetas/BOM.
  if (totalCostPesos != null && totalCostPesos > 0 && qty > 0) {
    unitCostCents = Math.round(totalCostPesos / qty);
  }

  const costBits: string[] = [];
  if (totalCostPesos != null && totalCostPesos > 0) {
    costBits.push(
      `Total compra $${totalCostPesos.toLocaleString("es-CO")}`,
    );
  }
  if (unitCostCents != null && unitCostCents > 0) {
    costBits.push(
      `Costo unit. $${unitCostCents.toLocaleString("es-CO")}`,
    );
  }
  const note =
    costBits.length === 0
      ? noteRaw
      : noteRaw
        ? `${noteRaw} · ${costBits.join(" · ")}`.slice(0, 240)
        : costBits.join(" · ").slice(0, 240);

  const supabase = await createSupabaseServerClient();
  const { data: ing, error: fetchErr } = await supabase
    .from("ingredients")
    .select("id, stock_qty, name")
    .eq("id", ingredientId)
    .maybeSingle();

  if (fetchErr || !ing) {
    return { ok: false, error: "No se encontró el insumo." };
  }

  const prev = Math.max(0, Number(ing.stock_qty ?? 0));
  const next = Math.round((prev + qty) * 10000) / 10000;

  const stockPatch: { stock_qty: number; unit_cost_cents?: number } = {
    stock_qty: next,
  };
  if (unitCostCents != null) {
    stockPatch.unit_cost_cents = unitCostCents;
  }

  const { error: updErr } = await supabase
    .from("ingredients")
    .update(stockPatch)
    .eq("id", ingredientId);

  if (updErr) {
    if (unitCostCents != null && /unit_cost_cents/i.test(updErr.message)) {
      const retry = await supabase
        .from("ingredients")
        .update({ stock_qty: next })
        .eq("id", ingredientId);
      if (retry.error) {
        console.error("addIngredientStockEntry update", retry.error.message);
        return { ok: false, error: "No se pudo actualizar el stock." };
      }
    } else {
      console.error("addIngredientStockEntry update", updErr.message);
      return { ok: false, error: "No se pudo actualizar el stock." };
    }
  }

  const { error: movErr } = await supabase.from("ingredient_stock_movements").insert({
    tenant_id: session.tenantId,
    ingredient_id: ingredientId,
    kind,
    quantity_delta: qty,
    quantity_after: next,
    unit_cost_cents: unitCostCents,
    note,
    created_by: session.userId,
  });

  if (movErr) {
    console.error("addIngredientStockEntry movement", movErr.message);
  }

  revalidatePath("/admin/ingredients");
  revalidatePath(`/admin/ingredients/${ingredientId}`);
  return { ok: true, stockQty: next };
}

export async function createIngredient(formData: FormData) {
  const session = await requireAdminPermission("productos_crear");
  const supabase = await createSupabaseServerClient();

  const name = String(formData.get("name") ?? "").trim();
  const unitRaw = String(formData.get("unit") ?? "g").trim().toLowerCase();
  const categoryKey = parseCategoryKey(formData.get("category_key"));
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500);
  const unitCostCents = parseOptionalCostCents(formData.get("unit_cost_cents"));
  const isActive = formData.get("is_active") !== "off";

  if (!name || name.length > 160) {
    redirect("/admin/ingredients/new?error=name");
  }
  if (!isIngredientUnit(unitRaw)) {
    redirect("/admin/ingredients/new?error=unit");
  }

  const slug = await uniqueIngredientSlug(
    supabase,
    session.tenantId,
    slugifyIngredientName(name),
  );

  const row: Record<string, unknown> = {
    tenant_id: session.tenantId,
    name,
    slug,
    unit: unitRaw,
    category_key: categoryKey,
    notes,
    is_active: isActive,
    stock_qty: 0,
  };
  if (unitCostCents != null) row.unit_cost_cents = unitCostCents;

  const { data, error } = await supabase
    .from("ingredients")
    .insert(row)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.error("createIngredient", error?.message);
    if (unitCostCents != null && error && /unit_cost_cents/i.test(error.message)) {
      delete row.unit_cost_cents;
      const retry = await supabase
        .from("ingredients")
        .insert(row)
        .select("id")
        .maybeSingle();
      if (retry.error || !retry.data) {
        redirect("/admin/ingredients/new?error=db");
      }
      revalidatePath("/admin/ingredients");
      redirect(`/admin/ingredients/${retry.data.id}?saved=1`);
    }
    if (error?.code === "23505") {
      redirect("/admin/ingredients/new?error=duplicate");
    }
    redirect("/admin/ingredients/new?error=db");
  }

  revalidatePath("/admin/ingredients");
  redirect(`/admin/ingredients/${data.id}?saved=1`);
}

export async function updateIngredient(ingredientId: string, formData: FormData) {
  const session = await requireAdminPermission("productos_editar");
  const supabase = await createSupabaseServerClient();
  const id = String(ingredientId ?? "").trim();
  if (!id) redirect("/admin/ingredients");

  const name = String(formData.get("name") ?? "").trim();
  const unitRaw = String(formData.get("unit") ?? "g").trim().toLowerCase();
  const categoryKey = parseCategoryKey(formData.get("category_key"));
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500);
  const unitCostCents = parseOptionalCostCents(formData.get("unit_cost_cents"));
  const clearCost = formData.get("clear_unit_cost") === "on";
  const isActive = formData.get("is_active") === "on";

  if (!name || name.length > 160) {
    redirect(`/admin/ingredients/${id}/edit?error=name`);
  }
  if (!isIngredientUnit(unitRaw)) {
    redirect(`/admin/ingredients/${id}/edit?error=unit`);
  }

  const { data: existing } = await supabase
    .from("ingredients")
    .select("id, slug, name")
    .eq("id", id)
    .maybeSingle();
  if (!existing) redirect("/admin/ingredients");

  const slug =
    existing.name === name
      ? String(existing.slug)
      : await uniqueIngredientSlug(
          supabase,
          session.tenantId,
          slugifyIngredientName(name),
          id,
        );

  const patch: Record<string, unknown> = {
    name,
    slug,
    unit: unitRaw,
    category_key: categoryKey,
    notes,
    is_active: isActive,
  };
  if (clearCost) {
    patch.unit_cost_cents = null;
  } else if (unitCostCents != null) {
    patch.unit_cost_cents = unitCostCents;
  }

  const { error } = await supabase.from("ingredients").update(patch).eq("id", id);
  if (error) {
    console.error("updateIngredient", error.message);
    if (/unit_cost_cents/i.test(error.message)) {
      delete patch.unit_cost_cents;
      const retry = await supabase.from("ingredients").update(patch).eq("id", id);
      if (retry.error) redirect(`/admin/ingredients/${id}/edit?error=db`);
    } else {
      redirect(`/admin/ingredients/${id}/edit?error=db`);
    }
  }

  revalidatePath("/admin/ingredients");
  revalidatePath(`/admin/ingredients/${id}`);
  revalidatePath(`/admin/ingredients/${id}/edit`);
  redirect(`/admin/ingredients/${id}?saved=1`);
}

export async function deleteIngredient(ingredientId: string) {
  await requireAdminPermission("productos_editar");
  const supabase = await createSupabaseServerClient();
  const id = String(ingredientId ?? "").trim();
  if (!id) redirect("/admin/ingredients");

  const { count, error: countErr } = await supabase
    .from("recipe_lines")
    .select("id", { count: "exact", head: true })
    .eq("ingredient_id", id);

  if (countErr) {
    console.error("deleteIngredient count", countErr.message);
    redirect(`/admin/ingredients/${id}?error=db`);
  }

  if ((count ?? 0) > 0) {
    redirect(
      `/admin/ingredients/${id}?error=in_use&recipes=${encodeURIComponent(String(count))}`,
    );
  }

  const { error } = await supabase.from("ingredients").delete().eq("id", id);
  if (error) {
    console.error("deleteIngredient", error.message);
    if (/foreign key|restrict|recipe_lines/i.test(error.message)) {
      redirect(`/admin/ingredients/${id}?error=in_use`);
    }
    redirect(`/admin/ingredients/${id}?error=db`);
  }

  revalidatePath("/admin/ingredients");
  redirect("/admin/ingredients?deleted=1");
}
