"use client";

import {
  adminFilterInputClass,
  adminFilterLabelClass,
} from "@/lib/admin-ui";

type Props = {
  defaultQ: string;
  defaultStatus: string;
  defaultUnit: string;
  units: string[];
};

export function IngredientFiltersBar({
  defaultQ,
  defaultStatus,
  defaultUnit,
  units,
}: Props) {
  return (
    <form
      method="get"
      action="/admin/ingredients"
      className="grid gap-2 sm:grid-cols-2 lg:grid-cols-12 lg:items-end lg:gap-3"
    >
      <div className="min-w-0 sm:col-span-2 lg:col-span-5">
        <label htmlFor="ing-q" className={adminFilterLabelClass}>
          Nombre
        </label>
        <input
          id="ing-q"
          name="q"
          type="search"
          defaultValue={defaultQ}
          placeholder="Buscar insumo…"
          enterKeyHint="search"
          className={adminFilterInputClass}
          autoComplete="off"
        />
      </div>
      <div className="min-w-0 lg:col-span-3">
        <label htmlFor="ing-status" className={adminFilterLabelClass}>
          Estado
        </label>
        <select
          id="ing-status"
          name="status"
          defaultValue={defaultStatus}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className={adminFilterInputClass}
        >
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>
      <div className="min-w-0 lg:col-span-4">
        <label htmlFor="ing-unit" className={adminFilterLabelClass}>
          Unidad
        </label>
        <select
          id="ing-unit"
          name="unit"
          defaultValue={defaultUnit}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className={adminFilterInputClass}
        >
          <option value="">Todas las unidades</option>
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
    </form>
  );
}
