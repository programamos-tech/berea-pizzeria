"use client";

import {
  adminFilterInputClass,
  adminFilterLabelClass,
} from "@/lib/admin-ui";
import { recipeCategoryLabel } from "@/lib/recipe-form";

type Props = {
  defaultQ: string;
  defaultKind: string;
  defaultCategory: string;
  categories: string[];
};

export function RecipeFiltersBar({
  defaultQ,
  defaultKind,
  defaultCategory,
  categories,
}: Props) {
  return (
    <form
      method="get"
      action="/admin/recipes"
      className="grid gap-2 sm:grid-cols-2 lg:grid-cols-12 lg:items-end lg:gap-3"
    >
      <div className="min-w-0 sm:col-span-2 lg:col-span-5">
        <label htmlFor="rec-q" className={adminFilterLabelClass}>
          Nombre
        </label>
        <input
          id="rec-q"
          name="q"
          type="search"
          defaultValue={defaultQ}
          placeholder="Buscar receta…"
          enterKeyHint="search"
          className={adminFilterInputClass}
          autoComplete="off"
        />
      </div>
      <div className="min-w-0 lg:col-span-3">
        <label htmlFor="rec-kind" className={adminFilterLabelClass}>
          Tipo
        </label>
        <select
          id="rec-kind"
          name="kind"
          defaultValue={defaultKind}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className={adminFilterInputClass}
        >
          <option value="all">Todos</option>
          <option value="prep">Preparación (§1–4)</option>
          <option value="menu">Menú (§5–12)</option>
        </select>
      </div>
      <div className="min-w-0 lg:col-span-4">
        <label htmlFor="rec-cat" className={adminFilterLabelClass}>
          Categoría
        </label>
        <select
          id="rec-cat"
          name="category"
          defaultValue={defaultCategory}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className={adminFilterInputClass}
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {recipeCategoryLabel(c)}
            </option>
          ))}
        </select>
      </div>
    </form>
  );
}
