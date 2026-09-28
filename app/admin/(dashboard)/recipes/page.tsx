import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { InventorySubnav } from "@/components/admin/InventorySubnav";
import { fetchAdminRecipes } from "@/lib/admin-menu-catalog";
import { loadAdminPermissions } from "@/lib/load-admin-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  adminPageSubtitleClass,
  adminPageTitleClass,
  adminToolbarIconBtnClass,
} from "@/lib/admin-ui";

export const dynamic = "force-dynamic";

const thClass =
  "pb-3 pr-5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500";
const tdClass = "py-3 pr-5 align-middle text-sm text-zinc-800 dark:text-zinc-100";

function kindLabel(kind: string) {
  return kind === "prep" ? "Preparación" : "Menú";
}

export default async function AdminRecipesPage() {
  const [perm, supabase] = await Promise.all([
    loadAdminPermissions(),
    createSupabaseServerClient(),
  ]);
  const canSeeProducts = Boolean(perm?.permissions.inventario_ver);
  const canSeeKits = Boolean(perm?.permissions.kits_ver);
  const recipes = await fetchAdminRecipes(supabase);
  const prep = recipes.filter((r) => r.kind === "prep").length;
  const menu = recipes.filter((r) => r.kind === "menu").length;

  return (
    <div className="flex w-full min-w-0 max-w-none flex-col gap-4">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-2 gap-y-3">
        <div className="min-w-0">
          <h1 className={adminPageTitleClass}>Inventario</h1>
          <p className={adminPageSubtitleClass}>
            Recetas · cómo se arma · {recipes.length} ({prep} prep · {menu} menú)
          </p>
        </div>
        <InventorySubnav
          active="recipes"
          showProducts={canSeeProducts}
          showKits={canSeeKits}
          showIngredients
          showRecipes
          trailing={
            <Link
              href="/admin/recipes"
              className={adminToolbarIconBtnClass}
              title="Recargar listado"
              aria-label="Actualizar"
            >
              <RefreshCw
                className="size-4 shrink-0"
                strokeWidth={2.25}
                aria-hidden
              />
            </Link>
          }
        />
      </header>

      {recipes.length === 0 ? (
        <p className="rounded-lg border border-zinc-200/80 bg-white px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
          No hay recetas. Ejecuta el seed del menú Liaco.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className={thClass}>Nombre</th>
                <th className={thClass}>Tipo</th>
                <th className={thClass}>Categoría</th>
                <th className={thClass}>Rendimiento</th>
                <th className={thClass}>Líneas BOM</th>
              </tr>
            </thead>
            <tbody>
              {recipes.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-zinc-50 last:border-0 dark:border-zinc-900"
                >
                  <td className={`${tdClass} font-medium`}>
                    <Link
                      href={`/admin/recipes/${r.id}`}
                      className="text-[var(--admin-coral-deep)] hover:underline"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className={tdClass}>{kindLabel(r.kind)}</td>
                  <td className={`${tdClass} capitalize`}>{r.category_key}</td>
                  <td className={tdClass}>
                    {r.yield_qty} {r.yield_unit}
                  </td>
                  <td className={tdClass}>{r.lines_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
