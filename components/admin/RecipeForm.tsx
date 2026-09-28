"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminFormSubmitButton } from "@/components/admin/AdminFormSubmitButton";
import {
  RECIPE_CATEGORY_PRESETS,
  RECIPE_LINE_UNITS,
} from "@/lib/recipe-form";
import {
  productInputClass as inputClass,
  productLabelClass as labelClass,
  productSectionTitle as sectionTitle,
} from "@/components/admin/product-form-primitives";

const cardClass =
  "rounded-xl border border-zinc-200 bg-white p-4 shadow-sm ring-1 ring-zinc-950/5 sm:p-6 dark:border-zinc-700/90 dark:bg-zinc-900 dark:shadow-none dark:ring-white/[0.06]";

export type RecipeFormIngredientOption = {
  id: string;
  name: string;
  unit: string;
};

export type RecipeFormPrepOption = {
  id: string;
  name: string;
};

export type RecipeFormLineInitial = {
  ingredientId: string;
  componentRecipeId: string;
  quantity: string;
  unit: string;
  optional: boolean;
  note: string;
};

type LineState = RecipeFormLineInitial & { key: string };

function newLine(unit = "g"): LineState {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ingredientId: "",
    componentRecipeId: "",
    quantity: "",
    unit,
    optional: false,
    note: "",
  };
}

export function RecipeForm({
  formAction,
  mode,
  cancelHref,
  ingredients,
  prepRecipes,
  initial,
}: {
  formAction: (formData: FormData) => void;
  mode: "create" | "edit";
  cancelHref: string;
  ingredients: RecipeFormIngredientOption[];
  prepRecipes: RecipeFormPrepOption[];
  initial?: {
    name: string;
    kind: string;
    categoryKey: string;
    yieldQty: string;
    yieldUnit: string;
    procedureText: string;
    isActive: boolean;
    lines: RecipeFormLineInitial[];
  };
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState(initial?.kind ?? "menu");
  const [categoryKey, setCategoryKey] = useState(
    initial?.categoryKey ?? "pizzas",
  );
  const [yieldQty, setYieldQty] = useState(initial?.yieldQty ?? "1");
  const [yieldUnit, setYieldUnit] = useState(initial?.yieldUnit ?? "porcion");
  const [procedureText, setProcedureText] = useState(
    initial?.procedureText ?? "",
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [lines, setLines] = useState<LineState[]>(() =>
    initial?.lines?.length
      ? initial.lines.map((l) => ({
          ...l,
          key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        }))
      : [newLine()],
  );

  return (
    <form action={formAction} className="mx-auto max-w-3xl space-y-6">
      <input type="hidden" name="line_count" value={String(lines.length)} />

      <section className={cardClass}>
        <h2 className={sectionTitle}>Datos de la receta</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="rec-name" className={labelClass}>
              Nombre <span className="text-red-600">*</span>
            </label>
            <input
              id="rec-name"
              name="name"
              required
              maxLength={160}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Pizza Barbacoa · Napolitana"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="rec-kind" className={labelClass}>
              Tipo
            </label>
            <select
              id="rec-kind"
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className={inputClass}
            >
              <option value="menu">Menú (plato vendible)</option>
              <option value="prep">Preparación (sub-receta)</option>
            </select>
          </div>

          <div>
            <label htmlFor="rec-cat" className={labelClass}>
              Categoría
            </label>
            <select
              id="rec-cat"
              name="category_key"
              value={categoryKey}
              onChange={(e) => setCategoryKey(e.target.value)}
              className={inputClass}
            >
              {RECIPE_CATEGORY_PRESETS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rec-yield-qty" className={labelClass}>
              Rendimiento (cantidad)
            </label>
            <input
              id="rec-yield-qty"
              name="yield_qty"
              inputMode="decimal"
              value={yieldQty}
              onChange={(e) => setYieldQty(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="rec-yield-unit" className={labelClass}>
              Unidad de rendimiento
            </label>
            <input
              id="rec-yield-unit"
              name="yield_unit"
              value={yieldUnit}
              onChange={(e) => setYieldUnit(e.target.value)}
              placeholder="porcion"
              className={inputClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="rec-proc" className={labelClass}>
              Procedimiento (opcional)
            </label>
            <textarea
              id="rec-proc"
              name="procedure_text"
              rows={4}
              value={procedureText}
              onChange={(e) => setProcedureText(e.target.value)}
              className={inputClass}
            />
          </div>

          {mode === "edit" ? (
            <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200 sm:col-span-2">
              <input
                type="checkbox"
                name="is_active"
                value="on"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-zinc-300 accent-zinc-900"
              />
              Activa
            </label>
          ) : (
            <input type="hidden" name="is_active" value="on" />
          )}
        </div>
      </section>

      <section className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={sectionTitle}>BOM · insumos</h2>
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, newLine()])}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          >
            + Añadir línea
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Cada línea usa un insumo o una preparación (sub-receta), no ambos.
        </p>

        <div className="mt-4 space-y-4">
          {lines.map((line, index) => (
            <div
              key={line.key}
              className="rounded-lg border border-zinc-200/90 p-3 dark:border-zinc-700"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Línea {index + 1}
                </p>
                {lines.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setLines((prev) => prev.filter((l) => l.key !== line.key))
                    }
                    className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                  >
                    Quitar
                  </button>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Insumo</label>
                  <select
                    name={`line_${index}_ingredient_id`}
                    value={line.ingredientId}
                    disabled={Boolean(line.componentRecipeId)}
                    onChange={(e) => {
                      const id = e.target.value;
                      const ing = ingredients.find((i) => i.id === id);
                      setLines((prev) =>
                        prev.map((l) =>
                          l.key === line.key
                            ? {
                                ...l,
                                ingredientId: id,
                                componentRecipeId: "",
                                unit: ing?.unit || l.unit,
                              }
                            : l,
                        ),
                      );
                    }}
                    className={inputClass}
                  >
                    <option value="">— Elegir insumo —</option>
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.unit})
                      </option>
                    ))}
                  </select>
                </div>

                {prepRecipes.length > 0 ? (
                  <div className="sm:col-span-2">
                    <label className={labelClass}>
                      O preparación (sub-receta)
                    </label>
                    <select
                      name={`line_${index}_component_recipe_id`}
                      value={line.componentRecipeId}
                      disabled={Boolean(line.ingredientId)}
                      onChange={(e) => {
                        const id = e.target.value;
                        setLines((prev) =>
                          prev.map((l) =>
                            l.key === line.key
                              ? {
                                  ...l,
                                  componentRecipeId: id,
                                  ingredientId: "",
                                  unit: id ? "lote" : l.unit,
                                }
                              : l,
                          ),
                        );
                      }}
                      className={inputClass}
                    >
                      <option value="">— Ninguna —</option>
                      {prepRecipes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <input
                    type="hidden"
                    name={`line_${index}_component_recipe_id`}
                    value=""
                  />
                )}

                <div>
                  <label className={labelClass}>Cantidad</label>
                  <input
                    name={`line_${index}_quantity`}
                    inputMode="decimal"
                    value={line.quantity}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l) =>
                          l.key === line.key
                            ? { ...l, quantity: e.target.value }
                            : l,
                        ),
                      )
                    }
                    className={inputClass}
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className={labelClass}>Unidad</label>
                  <select
                    name={`line_${index}_unit`}
                    value={line.unit}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l) =>
                          l.key === line.key
                            ? { ...l, unit: e.target.value }
                            : l,
                        ),
                      )
                    }
                    className={inputClass}
                  >
                    {RECIPE_LINE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>Nota</label>
                  <input
                    name={`line_${index}_note`}
                    value={line.note}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l) =>
                          l.key === line.key
                            ? { ...l, note: e.target.value }
                            : l,
                        ),
                      )
                    }
                    className={inputClass}
                    placeholder="Opcional"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 sm:col-span-2">
                  <input
                    type="checkbox"
                    name={`line_${index}_optional`}
                    value="on"
                    checked={line.optional}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l) =>
                          l.key === line.key
                            ? { ...l, optional: e.target.checked }
                            : l,
                        ),
                      )
                    }
                    className="rounded border-zinc-300 accent-zinc-900"
                  />
                  Línea opcional
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <AdminFormSubmitButton
          pendingLabel={mode === "create" ? "Creando…" : "Guardando…"}
        >
          {mode === "create" ? "Crear receta" : "Guardar cambios"}
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
