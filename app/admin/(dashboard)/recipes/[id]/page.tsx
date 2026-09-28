import Link from "next/link";
import { notFound } from "next/navigation";
import { InventorySubnav } from "@/components/admin/InventorySubnav";
import { RecipeDeleteConfirm } from "@/components/admin/RecipeDeleteConfirm";
import { RecipeProcedureSteps } from "@/components/admin/RecipeProcedureSteps";
import { fetchAdminRecipeDetail } from "@/lib/admin-menu-catalog";
import { loadAdminPermissions } from "@/lib/load-admin-permissions";
import {
  recipeCategoryLabel,
  recipeKindLabel,
} from "@/lib/recipe-form";
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

const thClass =
  "pb-3 pr-5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500";
const tdClass =
  "py-3.5 pr-5 align-middle text-sm text-zinc-800 dark:text-zinc-100";

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

  const [{ data: linkedProducts }, { data: variantLinks }] = await Promise.all([
    supabase
      .from("products")
      .select("id,name,is_published")
      .eq("recipe_id", id)
      .order("name", { ascending: true })
      .limit(24),
    supabase
      .from("product_recipe_variants")
      .select("id,label,product_id,products(id,name,is_published)")
      .eq("recipe_id", id)
      .limit(24),
  ]);

  const menuProducts = [
    ...new Map(
      [
        ...(linkedProducts ?? []).map((p) => ({
          id: String(p.id),
          name: String(p.name ?? ""),
          is_published: Boolean(p.is_published),
          via: "default" as const,
        })),
        ...(variantLinks ?? []).flatMap((v) => {
          const prod = v.products as
            | { id: string; name: string; is_published: boolean }
            | { id: string; name: string; is_published: boolean }[]
            | null;
          const one = Array.isArray(prod) ? prod[0] : prod;
          if (!one?.id) return [];
          return [
            {
              id: String(one.id),
              name: String(one.name ?? ""),
              is_published: Boolean(one.is_published),
              via: `variante ${String(v.label ?? "")}`.trim() as string,
            },
          ];
        }),
      ].map((p) => [p.id, p] as const),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, "es"));

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
            {recipeKindLabel(String(recipe.kind))} ·{" "}
            {recipeCategoryLabel(String(recipe.category_key))} · rinde{" "}
            {recipe.yield_qty} {recipe.yield_unit}
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

      <section className="rounded-xl border border-zinc-200/80 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Ítems del menú
        </h2>
        {menuProducts.length === 0 ? (
          <p className="text-zinc-500">
            {recipe.kind === "prep"
              ? "Preparación de cocina (no es ítem vendible directo)."
              : "Ningún producto del menú enlaza esta receta."}
          </p>
        ) : (
          <ul className="space-y-1">
            {menuProducts.map((p) => (
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
                {p.via !== "default" ? (
                  <span className="ml-2 text-xs text-zinc-400">{p.via}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <RecipeProcedureSteps
        procedureText={String(recipe.procedure_text ?? "")}
        editHref={canEdit ? `/admin/recipes/${id}/edit` : null}
        canEdit={canEdit}
      />

      <section className="min-w-0">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Componentes · BOM
          </h2>
          <p className="text-xs text-zinc-500">
            {lines.length} línea{lines.length === 1 ? "" : "s"}
          </p>
        </div>

        {lines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40">
            Sin líneas BOM (producto simple / reventa).
            {canEdit ? (
              <div className="mt-2">
                <Link
                  href={`/admin/recipes/${id}/edit`}
                  className="font-medium text-[var(--admin-coral-deep)] hover:underline"
                >
                  Añadir componentes
                </Link>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <ul
              role="list"
              className="divide-y divide-zinc-100 lg:hidden dark:divide-zinc-800"
            >
              {(lines as LineRow[]).map((line) => {
                const label =
                  line.ingredient_name || line.component_name || "—";
                const href = line.ingredient_id
                  ? `/admin/ingredients/${line.ingredient_id}`
                  : line.component_recipe_id
                    ? `/admin/recipes/${line.component_recipe_id}`
                    : null;
                return (
                  <li key={line.id} className="min-w-0 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {href ? (
                          <Link
                            href={href}
                            className="text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
                          >
                            {label}
                          </Link>
                        ) : (
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {label}
                          </p>
                        )}
                        <p className="mt-1 font-mono text-xs text-zinc-500">
                          {Number(line.quantity)} {line.unit}
                          {line.note ? ` · ${line.note}` : ""}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {line.is_optional ? (
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-950 ring-1 ring-amber-200/90 dark:bg-amber-950/45 dark:text-amber-100 dark:ring-amber-800/60">
                              Opcional
                            </span>
                          ) : null}
                          {line.component_recipe_id ? (
                            <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-900 ring-1 ring-sky-200/90 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-800/60">
                              Prep
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="hidden min-w-0 overflow-x-auto lg:block">
              <table className="w-full min-w-[720px] table-fixed text-left text-sm">
                <colgroup>
                  <col />
                  <col className="w-[9rem]" />
                  <col className="w-[8rem]" />
                  <col className="w-[14rem]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-zinc-200/70 dark:border-zinc-800">
                    <th className={thClass}>Componente</th>
                    <th className={thClass}>Cantidad</th>
                    <th className={thClass}>Tipo</th>
                    <th className={thClass}>Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {(lines as LineRow[]).map((line) => {
                    const label =
                      line.ingredient_name || line.component_name || "—";
                    const href = line.ingredient_id
                      ? `/admin/ingredients/${line.ingredient_id}`
                      : line.component_recipe_id
                        ? `/admin/recipes/${line.component_recipe_id}`
                        : null;
                    return (
                      <tr
                        key={line.id}
                        className="border-b border-zinc-100/80 last:border-0 transition hover:bg-zinc-50/50 dark:border-zinc-800/80 dark:hover:bg-zinc-900/40"
                      >
                        <td className={`${tdClass} min-w-0 overflow-hidden`}>
                          {href ? (
                            <Link
                              href={href}
                              className="block truncate font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                              title={label}
                            >
                              {label}
                            </Link>
                          ) : (
                            <span className="block truncate font-medium">
                              {label}
                            </span>
                          )}
                        </td>
                        <td
                          className={`${tdClass} font-mono text-xs tabular-nums text-zinc-600 dark:text-zinc-300`}
                        >
                          {Number(line.quantity)} {line.unit}
                        </td>
                        <td className={tdClass}>
                          <div className="flex flex-wrap gap-1.5">
                            {line.component_recipe_id ? (
                              <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-900 ring-1 ring-sky-200/90 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-800/60">
                                Prep
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 ring-1 ring-zinc-200/90 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700">
                                Insumo
                              </span>
                            )}
                            {line.is_optional ? (
                              <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-950 ring-1 ring-amber-200/90 dark:bg-amber-950/45 dark:text-amber-100 dark:ring-amber-800/60">
                                Opcional
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className={`${tdClass} text-xs text-zinc-500`}>
                          {line.note || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
