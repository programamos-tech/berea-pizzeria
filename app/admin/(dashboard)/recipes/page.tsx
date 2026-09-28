import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { InventorySubnav } from "@/components/admin/InventorySubnav";
import { RecipeFiltersBar } from "@/components/admin/RecipeFiltersBar";
import { RecipeTableActions } from "@/components/admin/RecipeTableActions";
import {
  filterRecipes,
  spString,
} from "@/lib/admin-inventory-filters";
import { fetchAdminRecipes } from "@/lib/admin-menu-catalog";
import { loadAdminPermissions } from "@/lib/load-admin-permissions";
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

function kindLabel(kind: string) {
  return kind === "prep" ? "Preparación" : "Menú";
}

export default async function AdminRecipesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const deleted = sp.deleted === "1" || sp.deleted === "true";
  const q = spString(sp, "q");
  const kind = spString(sp, "kind") || "all";
  const category = spString(sp, "category");
  const [perm, supabase] = await Promise.all([
    loadAdminPermissions(),
    createSupabaseServerClient(),
  ]);
  const canSeeProducts = Boolean(perm?.permissions.inventario_ver);
  const canSeeKits = Boolean(perm?.permissions.kits_ver);
  const canCreate = Boolean(perm?.permissions.productos_crear);
  const canEdit = Boolean(perm?.permissions.productos_editar);
  const allRecipes = await fetchAdminRecipes(supabase);
  const categories = [
    ...new Set(allRecipes.map((r) => r.category_key).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "es"));
  const recipes = filterRecipes(allRecipes, { q, kind, category });
  const hasFilters = Boolean(q || (kind && kind !== "all") || category);
  const prep = recipes.filter((r) => r.kind === "prep").length;
  const menu = recipes.filter((r) => r.kind === "menu").length;

  return (
    <div className="flex w-full min-w-0 max-w-none flex-col gap-4">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-2 gap-y-3">
        <div className="min-w-0">
          <h1 className={adminPageTitleClass}>Inventario</h1>
          <p className={adminPageSubtitleClass}>
            Recetas y BOM · {recipes.length}
            {hasFilters ? ` de ${allRecipes.length}` : ""} fichas ({prep} prep ·{" "}
            {menu} menú)
          </p>
        </div>
        <InventorySubnav
          active="recipes"
          showProducts={canSeeProducts}
          showKits={canSeeKits}
          showIngredients
          showRecipes
          trailing={
            <>
              <Link
                href="/admin/recipes"
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
                  href="/admin/recipes/new"
                  className={`${adminToolbarBtnBaseClass} ${adminToolbarBtnActiveClass}`}
                >
                  + Nueva receta
                </Link>
              ) : null}
            </>
          }
        />
      </header>

      {deleted ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          Receta eliminada.
        </p>
      ) : null}

      <RecipeFiltersBar
        defaultQ={q}
        defaultKind={kind}
        defaultCategory={category}
        categories={categories}
      />

      {allRecipes.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Aún no hay recetas.
          </p>
          {canCreate ? (
            <Link
              href="/admin/recipes/new"
              className="mt-3 inline-block text-sm font-medium text-zinc-800 underline-offset-2 hover:underline dark:text-zinc-200"
            >
              Crear la primera
            </Link>
          ) : null}
        </div>
      ) : recipes.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No hay recetas con estos criterios.
          </p>
          <Link
            href="/admin/recipes"
            className="mt-3 inline-block text-sm font-medium text-zinc-800 underline-offset-2 hover:underline dark:text-zinc-200"
          >
            Limpiar filtros
          </Link>
        </div>
      ) : (
        <>
          <ul
            role="list"
            className="divide-y divide-zinc-100 lg:hidden dark:divide-zinc-800"
          >
            {recipes.map((r) => (
              <li key={r.id} className="min-w-0 py-4">
                <div className="flex items-start justify-between gap-4">
                  <Link
                    href={`/admin/recipes/${r.id}`}
                    className="min-w-0 flex-1 no-underline"
                  >
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {r.name}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {kindLabel(r.kind)} · {r.category_key} · {r.lines_count}{" "}
                      líneas
                    </p>
                  </Link>
                  <RecipeTableActions
                    recipeId={r.id}
                    recipeName={r.name}
                    linkedProductId={r.linked_product_id}
                    canEdit={canEdit}
                  />
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden min-w-0 overflow-x-auto lg:block">
            <table className="w-full min-w-[960px] table-fixed text-left text-sm">
              <colgroup>
                <col />
                <col className="w-[7.5rem]" />
                <col className="w-[8rem]" />
                <col className="w-[8rem]" />
                <col className="w-[6rem]" />
                <col className="w-[9rem]" />
              </colgroup>
              <thead>
                <tr className="border-b border-zinc-200/70 dark:border-zinc-800">
                  <th className={thClass}>Nombre</th>
                  <th className={thClass}>Tipo</th>
                  <th className={thClass}>Categoría</th>
                  <th className={thClass}>Rendimiento</th>
                  <th className={`${thClass} text-right`}>BOM</th>
                  <th className={`${thClass} pr-2 text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {recipes.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-zinc-100/80 last:border-0 transition hover:bg-zinc-50/50 dark:border-zinc-800/80 dark:hover:bg-zinc-900/40"
                  >
                    <td className={`${tdClass} min-w-0 overflow-hidden`}>
                      <Link
                        href={`/admin/recipes/${r.id}`}
                        className="block truncate font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                        title={r.name}
                      >
                        {r.name}
                      </Link>
                      {r.linked_product_name ? (
                        <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                          Menú: {r.linked_product_name}
                        </p>
                      ) : null}
                    </td>
                    <td className={tdClass}>{kindLabel(r.kind)}</td>
                    <td className={`${tdClass} capitalize text-xs text-zinc-600 dark:text-zinc-300`}>
                      {r.category_key}
                    </td>
                    <td className={`${tdClass} text-xs tabular-nums text-zinc-600`}>
                      {r.yield_qty} {r.yield_unit}
                    </td>
                    <td
                      className={`${tdClass} text-right font-mono text-xs tabular-nums font-semibold`}
                    >
                      {r.lines_count}
                    </td>
                    <td className={`${tdClass} pr-2 text-right`}>
                      <div className="flex justify-end">
                        <RecipeTableActions
                          recipeId={r.id}
                          recipeName={r.name}
                          linkedProductId={r.linked_product_id}
                          canEdit={canEdit}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
