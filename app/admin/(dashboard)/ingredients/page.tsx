import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { IngredientFiltersBar } from "@/components/admin/IngredientFiltersBar";
import { IngredientTableActions } from "@/components/admin/IngredientTableActions";
import { InventorySubnav } from "@/components/admin/InventorySubnav";
import {
  filterIngredients,
  spString,
} from "@/lib/admin-inventory-filters";
import { fetchAdminIngredients } from "@/lib/admin-menu-catalog";
import { ingredientCategoryLabel } from "@/lib/ingredient-categories";
import { loadAdminPermissions } from "@/lib/load-admin-permissions";
import { formatCop } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  adminPageSubtitleClass,
  adminPageTitleClass,
  adminToolbarBtnActiveClass,
  adminToolbarBtnBaseClass,
  adminToolbarIconBtnClass,
} from "@/lib/admin-ui";

export const dynamic = "force-dynamic";

const thClass =
  "pb-3 pr-5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500";
const tdClass = "py-3.5 pr-5 align-middle text-sm text-zinc-800 dark:text-zinc-100";

export default async function AdminIngredientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const deleted = sp.deleted === "1" || sp.deleted === "true";
  const q = spString(sp, "q");
  const status = spString(sp, "status") || "all";
  const unit = spString(sp, "unit");
  const category = spString(sp, "category");
  const [perm, supabase] = await Promise.all([
    loadAdminPermissions(),
    createSupabaseServerClient(),
  ]);
  const canSeeProducts = Boolean(perm?.permissions.inventario_ver);
  const canSeeKits = Boolean(perm?.permissions.kits_ver);
  const canStock = Boolean(perm?.permissions.stock_actualizar);
  const canCreate = Boolean(perm?.permissions.productos_crear);
  const canEdit = Boolean(perm?.permissions.productos_editar);
  const allIngredients = await fetchAdminIngredients(supabase);
  const units = [
    ...new Set(allIngredients.map((i) => i.unit).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "es"));
  const categories = [
    ...new Set(allIngredients.map((i) => i.category_key).filter(Boolean)),
  ].sort((a, b) =>
    ingredientCategoryLabel(a).localeCompare(
      ingredientCategoryLabel(b),
      "es",
    ),
  );
  const ingredients = filterIngredients(allIngredients, {
    q,
    status,
    unit,
    category,
  });
  const hasFilters = Boolean(
    q || (status && status !== "all") || unit || category,
  );

  return (
    <div className="flex w-full min-w-0 max-w-none flex-col gap-4">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-2 gap-y-3">
        <div className="min-w-0">
          <h1 className={adminPageTitleClass}>Inventario</h1>
          <p className={adminPageSubtitleClass}>
            Ingresos de inventario · registrá compras y entradas de stock
            ({ingredients.length}
            {hasFilters ? ` de ${allIngredients.length}` : ""} insumos).
          </p>
        </div>
        <InventorySubnav
          active="ingredients"
          showProducts={canSeeProducts}
          showKits={canSeeKits}
          showIngredients
          showRecipes
          trailing={
            <>
              <Link
                href="/admin/ingredients"
                className={adminToolbarIconBtnClass}
                title="Quitar filtros y recargar"
                aria-label="Actualizar"
              >
                <RefreshCw
                  className="size-4 shrink-0"
                  strokeWidth={2.25}
                  aria-hidden
                />
              </Link>
              {canCreate ? (
                <Link
                  href="/admin/ingredients/new"
                  className={`${adminToolbarBtnBaseClass} ${adminToolbarBtnActiveClass}`}
                >
                  + Nuevo insumo
                </Link>
              ) : null}
            </>
          }
        />
      </header>

      {deleted ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          Insumo eliminado.
        </p>
      ) : null}

      <IngredientFiltersBar
        defaultQ={q}
        defaultStatus={status}
        defaultUnit={unit}
        defaultCategory={category}
        units={units}
        categories={categories}
      />

      {allIngredients.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Aún no hay insumos.
          </p>
          {canCreate ? (
            <Link
              href="/admin/ingredients/new"
              className="mt-3 inline-block text-sm font-medium text-zinc-800 underline-offset-2 hover:underline dark:text-zinc-200"
            >
              Crear el primero
            </Link>
          ) : null}
        </div>
      ) : ingredients.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No hay insumos con estos criterios.
          </p>
          <Link
            href="/admin/ingredients"
            className="mt-3 inline-block text-sm font-medium text-zinc-800 underline-offset-2 hover:underline dark:text-zinc-200"
          >
            Limpiar filtros
          </Link>
        </div>
      ) : (
        <>
          {/* Móvil */}
          <ul
            role="list"
            className="divide-y divide-zinc-100 lg:hidden dark:divide-zinc-800"
          >
            {ingredients.map((ing) => {
              const categoryLabel = ingredientCategoryLabel(ing.category_key);
              return (
                <li key={ing.id} className="min-w-0 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/admin/ingredients/${ing.id}`}
                      className="min-w-0 flex-1 no-underline"
                    >
                      <p
                        className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100"
                        title={ing.name}
                      >
                        {ing.name}
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-zinc-500 sm:grid-cols-3">
                        <p className="min-w-0 truncate" title={categoryLabel}>
                          <span className="font-medium text-zinc-600 dark:text-zinc-400">
                            Cat.{" "}
                          </span>
                          {categoryLabel}
                        </p>
                        <p>
                          <span className="font-medium text-zinc-600 dark:text-zinc-400">
                            Unid.{" "}
                          </span>
                          <span className="font-mono">{ing.unit}</span>
                        </p>
                        <p>
                          <span className="font-medium text-zinc-600 dark:text-zinc-400">
                            Stock{" "}
                          </span>
                          <span className="font-mono tabular-nums">
                            {Number(ing.stock_qty).toLocaleString("es-CO", {
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </p>
                        <p>
                          <span className="font-medium text-zinc-600 dark:text-zinc-400">
                            Costo{" "}
                          </span>
                          {ing.unit_cost_cents != null
                            ? formatCop(ing.unit_cost_cents)
                            : "—"}
                        </p>
                        <p>
                          <span className="font-medium text-zinc-600 dark:text-zinc-400">
                            Estado{" "}
                          </span>
                          {ing.is_active ? "Activo" : "Inactivo"}
                        </p>
                      </div>
                    </Link>
                    <IngredientTableActions
                      ingredientId={ing.id}
                      ingredientName={ing.name}
                      unit={ing.unit}
                      stockQty={ing.stock_qty}
                      canEdit={canEdit}
                      canStock={canStock}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Desktop — anchos proporcionales (Nombre acotado) */}
          <div className="hidden min-w-0 overflow-x-auto lg:block">
            <table className="w-full min-w-[720px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[26%]" />
                <col className="w-[16%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-zinc-200/70 dark:border-zinc-800">
                  <th className={thClass}>Nombre</th>
                  <th className={thClass}>Categoría</th>
                  <th className={thClass}>Unidad</th>
                  <th className={`${thClass} text-right`}>Stock</th>
                  <th className={`${thClass} text-right`}>Costo unit.</th>
                  <th className={thClass}>Estado</th>
                  <th className={`${thClass} pr-2 text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.map((ing) => {
                  const categoryLabel = ingredientCategoryLabel(
                    ing.category_key,
                  );
                  return (
                    <tr
                      key={ing.id}
                      className="border-b border-zinc-100/80 last:border-0 transition hover:bg-zinc-50/50 dark:border-zinc-800/80 dark:hover:bg-zinc-900/40"
                    >
                      <td className={`${tdClass} max-w-0 overflow-hidden`}>
                        <Link
                          href={`/admin/ingredients/${ing.id}`}
                          className="block max-w-full truncate font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                          title={ing.name}
                        >
                          {ing.name}
                        </Link>
                      </td>
                      <td
                        className={`${tdClass} max-w-0 overflow-hidden text-xs text-zinc-600 dark:text-zinc-300`}
                      >
                        <span className="block truncate" title={categoryLabel}>
                          {categoryLabel}
                        </span>
                      </td>
                      <td
                        className={`${tdClass} font-mono text-xs text-zinc-600 dark:text-zinc-300`}
                      >
                        {ing.unit}
                      </td>
                      <td
                        className={`${tdClass} text-right font-mono text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-50`}
                      >
                        {Number(ing.stock_qty).toLocaleString("es-CO", {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td
                        className={`${tdClass} text-right text-xs tabular-nums text-zinc-600 dark:text-zinc-300`}
                      >
                        {ing.unit_cost_cents != null
                          ? formatCop(ing.unit_cost_cents)
                          : "—"}
                      </td>
                      <td className={tdClass}>
                        {ing.is_active ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-900 ring-1 ring-emerald-200/90 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800/60">
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 ring-1 ring-zinc-200/90 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700">
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className={`${tdClass} pr-2 text-right`}>
                        <div className="flex justify-end">
                          <IngredientTableActions
                            ingredientId={ing.id}
                            ingredientName={ing.name}
                            unit={ing.unit}
                            stockQty={ing.stock_qty}
                            canEdit={canEdit}
                            canStock={canStock}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
