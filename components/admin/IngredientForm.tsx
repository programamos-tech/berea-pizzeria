"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminFormSubmitButton } from "@/components/admin/AdminFormSubmitButton";
import {
  INGREDIENT_CATEGORY_PRESETS,
  ingredientCategoryLabel,
} from "@/lib/ingredient-categories";
import { INGREDIENT_UNITS } from "@/lib/ingredient-units";
import { formatCop } from "@/lib/money";
import {
  productInputClass as inputClass,
  productLabelClass as labelClass,
  productSectionTitle as sectionTitle,
} from "@/components/admin/product-form-primitives";

const cardClass =
  "rounded-xl border border-zinc-200 bg-white p-4 shadow-sm ring-1 ring-zinc-950/5 sm:p-6 dark:border-zinc-700/90 dark:bg-zinc-900 dark:shadow-none dark:ring-white/[0.06]";

type Initial = {
  name: string;
  unit: string;
  notes: string;
  unitCostCents: number | null;
  isActive: boolean;
  categoryKey: string;
};

export function IngredientForm({
  formAction,
  initial,
  mode,
  cancelHref,
}: {
  formAction: (formData: FormData) => void;
  initial?: Initial;
  mode: "create" | "edit";
  cancelHref: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "g");
  const [categoryKey, setCategoryKey] = useState(
    initial?.categoryKey ?? "otros",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [costText, setCostText] = useState(
    initial?.unitCostCents != null && initial.unitCostCents > 0
      ? String(initial.unitCostCents)
      : "",
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  return (
    <form action={formAction} className="mx-auto max-w-xl space-y-6">
      <section className={cardClass}>
        <h2 className={sectionTitle}>
          {mode === "create" ? "Nuevo insumo" : "Datos del insumo"}
        </h2>
        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="ing-name" className={labelClass}>
              Nombre <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <input
              id="ing-name"
              name="name"
              required
              maxLength={160}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Mozzarella"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="ing-unit" className={labelClass}>
              Unidad <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <select
              id="ing-unit"
              name="unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className={inputClass}
            >
              {INGREDIENT_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ing-category" className={labelClass}>
              Categoría
            </label>
            <select
              id="ing-category"
              name="category_key"
              value={categoryKey}
              onChange={(e) => setCategoryKey(e.target.value)}
              className={inputClass}
            >
              {INGREDIENT_CATEGORY_PRESETS.map((c) => (
                <option key={c} value={c}>
                  {ingredientCategoryLabel(c)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ing-cost" className={labelClass}>
              Costo unitario COP (opcional)
            </label>
            <input
              id="ing-cost"
              name="unit_cost_cents"
              inputMode="numeric"
              value={costText}
              onChange={(e) => setCostText(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="ej. 38"
              className={inputClass}
            />
            <p className="mt-1.5 text-[11px] leading-snug text-zinc-500">
              Por {unit}. Se usa para el costo estimado de recetas.
              {initial?.unitCostCents != null && initial.unitCostCents > 0 ? (
                <> Actual: {formatCop(initial.unitCostCents)}.</>
              ) : null}
            </p>
            {mode === "edit" &&
            initial?.unitCostCents != null &&
            initial.unitCostCents > 0 ? (
              <label className="mt-2 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  name="clear_unit_cost"
                  value="on"
                  className="rounded border-zinc-300 accent-zinc-900"
                />
                Quitar costo unitario
              </label>
            ) : null}
          </div>

          <div>
            <label htmlFor="ing-notes" className={labelClass}>
              Notas (opcional)
            </label>
            <textarea
              id="ing-notes"
              name="notes"
              rows={3}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Proveedor, marca, observaciones…"
              className={inputClass}
            />
          </div>

          {mode === "edit" ? (
            <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
              <input
                type="checkbox"
                name="is_active"
                value="on"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-zinc-300 accent-zinc-900"
              />
              Activo
            </label>
          ) : (
            <input type="hidden" name="is_active" value="on" />
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <AdminFormSubmitButton
          pendingLabel={mode === "create" ? "Creando…" : "Guardando…"}
        >
          {mode === "create" ? "Crear insumo" : "Guardar cambios"}
        </AdminFormSubmitButton>
        <Link
          href={cancelHref}
          className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
