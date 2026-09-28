"use server";

import { revalidatePath } from "next/cache";
import { requireAdminPermission } from "@/lib/require-admin-permission";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

/** Entrada de compra / ajuste positivo de stock de un insumo. */
export async function addIngredientStockEntry(
  formData: FormData,
): Promise<IngredientStockEntryResult> {
  const session = await requireAdminPermission("stock_actualizar");
  const ingredientId = String(formData.get("ingredient_id") ?? "").trim();
  const qty = parseQty(formData.get("quantity"));
  const note = String(formData.get("note") ?? "").trim().slice(0, 240);
  const unitCostCents = parseOptionalCostCents(formData.get("unit_cost_cents"));
  const kindRaw = String(formData.get("kind") ?? "purchase");
  const kind = kindRaw === "adjust" ? "adjust" : "purchase";

  if (!ingredientId) return { ok: false, error: "Insumo inválido." };
  if (qty == null) return { ok: false, error: "Indicá una cantidad mayor a 0." };

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

  const { error: updErr } = await supabase
    .from("ingredients")
    .update({ stock_qty: next })
    .eq("id", ingredientId);

  if (updErr) {
    console.error("addIngredientStockEntry update", updErr.message);
    return { ok: false, error: "No se pudo actualizar el stock." };
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
    // Stock already updated — surface soft failure but still revalidate.
  }

  revalidatePath("/admin/ingredients");
  return { ok: true, stockQty: next };
}
