import Link from "next/link";
import { notFound } from "next/navigation";
import { InventorySubnav } from "@/components/admin/InventorySubnav";
import { RecipeDeleteConfirm } from "@/components/admin/RecipeDeleteConfirm";
import { fetchAdminRecipeDetail } from "@/lib/admin-menu-catalog";
import { loadAdminPermissions } from "@/lib/load-admin-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  adminPageSubtitleClass,
  adminPageTitleClass,
} from "@/lib/admin-ui";

export const dynamic = "force-dynamic";

type LineRow = {
  id: string;
  quantity: number;
  unit: string;
  is_optional: boolean;
  note: string;
  ingredient_id?: string | null;
  component_recipe_id?: string | null;
  ingredient_name?: string | null;
  component_name?: string | null;
};

export default async function AdminRecipeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const saved = sp.saved === "1";
  const productsN =
    typeof sp.products === "string" ? Number(sp.products) : NaN;
  const variantsN =
    typeof sp.variants === "string" ? Number(sp.variants) : NaN;
  const componentN = typeof sp.n === "string" ? Number(sp.n) : NaN;

  const [perm, supabase] = await Promise.all([
    loadAdminPermissions(),
    createSupabaseServerClient(),
  ]);
  const detail = await fetchAdminRecipeDetail(supabase, id);
  if (!detail) notFound();

  const { recipe, lines } = detail;
  const canSeeProducts = Boolean(perm?.permissions.inventario_ver);
  const canSeeKits = Boolean(perm?.permissions.kits_ver);
  const canEdit = Boolean(perm?.permissions.productos_editar);

  const { data: linkedProducts } = await supabase
    .from("products")
    .select("id,name,is_published")
    .eq("recipe_id", id)
    .order("name", { ascending: true })
    .limit(12);

  return (
    <div className="flex w-full min-w-0 max-w-none flex-col gap-4">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-2 gap-y-3">
        <div className="min-w-0">
          <p className="mb-1 text-xs text-zinc-500">
            <Link href="/admin/recipes" className="hover:underline">
              Inventario · Recetas
            </Link>
            <span className="mx-1.5">/</span>
            <span>{recipe.name}</span>
          </p>
          <h1 className={adminPageTitleClass}>{recipe.name}</h1>
          <p className={adminPageSubtitleClass}>
            {recipe.kind === "prep" ? "Preparación" : "Menú"} ·{" "}
            {recipe.category_key} · rinde {recipe.yield_qty}{" "}
            {recipe.yield_unit}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <Link
              href={`/admin/recipes/${id}/edit`}
              className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            >
              Editar
            </Link>
          ) : null}
          {canEdit ? (
            <RecipeDeleteConfirm
              recipeId={id}
              recipeName={String(recipe.name)}
              variant="button"
            />
          ) : null}
          <InventorySubnav
            active="recipes"
            showProducts={canSeeProducts}
            showKits={canSeeKits}
            showIngredients
            showRecipes
          />
        </div>
      </header>

      {saved ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          Cambios guardados.
        </p>
      ) : null}

      {error === "in_use" ? (
        <p
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-100"
          role="alert"
        >
          No se puede eliminar: esta receta está vinculada a{" "}
          {Number.isFinite(productsN) && productsN > 0
            ? `${productsN} ítem${productsN === 1 ? "" : "s"} del menú`
            : "ítems del menú"}
          {Number.isFinite(variantsN) && variantsN > 0
            ? ` y ${variantsN} variante${variantsN === 1 ? "" : "s"}`
            : ""}
          . Desvinculá el producto primero.
        </p>
      ) : null}
      {error === "as_component" ? (
        <p
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-100"
          role="alert"
        >
          No se puede eliminar: se usa como sub-receta en{" "}
          {Number.isFinite(componentN) && componentN > 0
            ? `${componentN} línea${componentN === 1 ? "" : "s"}`
            : "otras recetas"}
          .
        </p>
      ) : null}
      {error === "db" ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          No se pudo completar la acción.
        </p>
      ) : null}

      {(linkedProducts ?? []).length > 0 ? (
        <section className="rounded-xl border border-zinc-200/80 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Ítems del menú
          </h2>
          <ul className="space-y-1">
            {(linkedProducts ?? []).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/admin/products/${p.id}`}
                  className="font-medium text-[var(--admin-coral-deep)] hover:underline"
                >
                  {p.name}
                </Link>
                {!p.is_published ? (
                  <span className="ml-2 text-xs text-zinc-400">borrador</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {recipe.procedure_text ? (
        <section className="rounded-xl border border-zinc-200/80 bg-white px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
          <h2 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Procedimiento
          </h2>
          <p className="whitespace-pre-wrap">{recipe.procedure_text}</p>
        </section>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              <th className="pb-3 pr-5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Componente
              </th>
              <th className="pb-3 pr-5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Cantidad
              </th>
              <th className="pb-3 pr-5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Nota
              </th>
            </tr>
          </thead>
          <tbody>
            {(lines as LineRow[]).map((line) => {
              const label = line.ingredient_name || line.component_name || "—";
              return (
                <tr
                  key={line.id}
                  className="border-b border-zinc-50 last:border-0 dark:border-zinc-900"
                >
                  <td className="py-2.5 pr-5 font-medium text-zinc-800 dark:text-zinc-100">
                    {label}
                    {line.is_optional ? (
                      <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-400">
                        opcional
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-5 font-mono text-xs text-zinc-600 dark:text-zinc-300">
                    {Number(line.quantity)} {line.unit}
                  </td>
                  <td className="py-2.5 pr-5 text-zinc-500">{line.note || "—"}</td>
                </tr>
              );
            })}
            {lines.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-zinc-500"
                >
                  Sin líneas BOM (producto simple / reventa).
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
