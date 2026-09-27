import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { InventorySubnav } from "@/components/admin/InventorySubnav";
import { fetchAdminIngredients } from "@/lib/admin-menu-catalog";
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

export default async function AdminIngredientsPage() {
  const [perm, supabase] = await Promise.all([
    loadAdminPermissions(),
    createSupabaseServerClient(),
  ]);
  const canSeeProducts = Boolean(perm?.permissions.inventario_ver);
  const canSeeKits = Boolean(perm?.permissions.kits_ver);
  const ingredients = await fetchAdminIngredients(supabase);

  return (
    <div className="flex w-full min-w-0 max-w-none flex-col gap-4">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 gap-y-2">
        <div className="min-w-0">
          <h1 className={adminPageTitleClass}>Inventario</h1>
          <p className={adminPageSubtitleClass}>
            Insumos del menú Liaco ({ingredients.length})
          </p>
        </div>
        <Link
          href="/admin/ingredients"
          className={adminToolbarIconBtnClass}
          title="Recargar listado"
          aria-label="Actualizar"
        >
          <RefreshCw className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
        </Link>
      </header>

      <InventorySubnav
        active="ingredients"
        showProducts={canSeeProducts}
        showKits={canSeeKits}
        showIngredients
        showRecipes
      />

      {ingredients.length === 0 ? (
        <p className="rounded-lg border border-zinc-200/80 bg-white px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
          No hay insumos. Ejecuta el seed del menú Liaco.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className={thClass}>Nombre</th>
                <th className={thClass}>Unidad</th>
                <th className={thClass}>Slug</th>
                <th className={thClass}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ing) => (
                <tr
                  key={ing.id}
                  className="border-b border-zinc-50 last:border-0 dark:border-zinc-900"
                >
                  <td className={`${tdClass} font-medium`}>{ing.name}</td>
                  <td className={tdClass}>
                    <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300">
                      {ing.unit}
                    </span>
                  </td>
                  <td className={`${tdClass} text-zinc-500`}>{ing.slug}</td>
                  <td className={tdClass}>
                    {ing.is_active ? (
                      <span className="text-emerald-700 dark:text-emerald-400">
                        Activo
                      </span>
                    ) : (
                      <span className="text-zinc-400">Inactivo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
