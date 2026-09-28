import Link from "next/link";
import { notFound } from "next/navigation";
import { IngredientDeleteConfirm } from "@/components/admin/IngredientDeleteConfirm";
import { IngredientStockEntryButton } from "@/components/admin/IngredientStockEntryButton";
import { fetchAdminIngredientById } from "@/lib/admin-menu-catalog";
import { ingredientCategoryLabel } from "@/lib/ingredient-categories";
import { loadAdminPermissions } from "@/lib/load-admin-permissions";
import { formatCop } from "@/lib/money";
import { recipeCategoryLabel, recipeKindLabel } from "@/lib/recipe-form";
import { requireAdminPermission } from "@/lib/require-admin-permission";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function IngredientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPermission("inventario_ver");
  const { id } = await params;
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const recipesCount =
    typeof sp.recipes === "string" ? Number(sp.recipes) : NaN;
  const saved = sp.saved === "1";

  const [perm, supabase] = await Promise.all([
    loadAdminPermissions(),
    createSupabaseServerClient(),
  ]);
  const ing = await fetchAdminIngredientById(supabase, id);
  if (!ing) notFound();

  const canEdit = Boolean(perm?.permissions.productos_editar);
  const canStock = Boolean(perm?.permissions.stock_actualizar);

  const { data: recipeRows } = await supabase
    .from("recipe_lines")
    .select("recipe_id, recipes(id, name, kind, category_key)")
    .eq("ingredient_id", id)
    .limit(80);

  const recipes = [
    ...new Map(
      (recipeRows ?? [])
        .map((row) => {
          const r = row.recipes as
            | {
                id: string;
                name: string;
                kind: string;
                category_key: string;
              }
            | {
                id: string;
                name: string;
                kind: string;
                category_key: string;
              }[]
            | null;
          const one = Array.isArray(r) ? r[0] : r;
          if (!one?.id) return null;
          return [
            one.id,
            {
              id: one.id,
              name: one.name?.trim() || "Receta",
              kind: one.kind || "menu",
              category_key: one.category_key || "",
            },
          ] as const;
        })
        .filter(
          (
            x,
          ): x is readonly [
            string,
            {
              id: string;
              name: string;
              kind: string;
              category_key: string;
            },
          ] => Boolean(x),
        ),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, "es"));

  const recipeIds = recipes.map((r) => r.id);
  const productsByRecipe = new Map<
    string,
    { id: string; name: string }[]
  >();
  if (recipeIds.length) {
    const [{ data: directProducts }, { data: variantRows }] =
      await Promise.all([
        supabase
          .from("products")
          .select("id,name,recipe_id")
          .in("recipe_id", recipeIds),
        supabase
          .from("product_recipe_variants")
          .select("product_id,recipe_id,products(id,name)")
          .in("recipe_id", recipeIds),
      ]);
    for (const p of directProducts ?? []) {
      const rid = String(p.recipe_id ?? "");
      if (!rid) continue;
      const list = productsByRecipe.get(rid) ?? [];
      if (!list.some((x) => x.id === p.id)) {
        list.push({ id: String(p.id), name: String(p.name ?? "") });
      }
      productsByRecipe.set(rid, list);
    }
    for (const v of variantRows ?? []) {
      const rid = String(v.recipe_id ?? "");
      const prod = v.products as
        | { id: string; name: string }
        | { id: string; name: string }[]
        | null;
      const one = Array.isArray(prod) ? prod[0] : prod;
      if (!rid || !one?.id) continue;
      const list = productsByRecipe.get(rid) ?? [];
      if (!list.some((x) => x.id === one.id)) {
        list.push({ id: String(one.id), name: String(one.name ?? "") });
      }
      productsByRecipe.set(rid, list);
    }
  }

  const products = [
    ...new Map(
      [...productsByRecipe.values()]
        .flat()
        .map((p) => [p.id, p] as const),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, "es"));

  return (
    <div className="flex w-full min-w-0 max-w-2xl flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-zinc-500">
            <Link
              href="/admin/ingredients"
              className="hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Insumos
            </Link>
            <span className="mx-1.5 text-zinc-400">/</span>
            <span className="text-zinc-600 dark:text-zinc-400">Detalle</span>
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {ing.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {ingredientCategoryLabel(ing.category_key)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canStock ? (
            <IngredientStockEntryButton
              ingredientId={ing.id}
              ingredientName={ing.name}
              unit={ing.unit}
              stockQty={ing.stock_qty}
              variant="label"
            />
          ) : null}
          {canEdit ? (
            <Link
              href={`/admin/ingredients/${ing.id}/edit`}
              className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            >
              Editar
            </Link>
          ) : null}
          {canEdit ? (
            <IngredientDeleteConfirm
              ingredientId={ing.id}
              ingredientName={ing.name}
              variant="button"
            />
          ) : null}
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
          No se puede eliminar: este insumo está en{" "}
          {Number.isFinite(recipesCount) && recipesCount > 0
            ? `${recipesCount} línea${recipesCount === 1 ? "" : "s"} de receta`
            : "una o más recetas"}
          . Quitálo de las recetas primero.
        </p>
      ) : null}
      {error === "db" ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          No se pudo completar la acción.
        </p>
      ) : null}

      <dl className="grid gap-4 rounded-xl border border-zinc-200/80 bg-white p-5 text-sm dark:border-zinc-800 dark:bg-zinc-950 sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Categoría
          </dt>
          <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
            {ingredientCategoryLabel(ing.category_key)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Unidad
          </dt>
          <dd className="mt-1 font-mono text-zinc-900 dark:text-zinc-100">
            {ing.unit}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Stock
          </dt>
          <dd className="mt-1 font-mono tabular-nums text-zinc-900 dark:text-zinc-100">
            {Number(ing.stock_qty).toLocaleString("es-CO", {
              maximumFractionDigits: 2,
            })}{" "}
            {ing.unit}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Costo unitario
          </dt>
          <dd className="mt-1 tabular-nums text-zinc-900 dark:text-zinc-100">
            {ing.unit_cost_cents != null
              ? `${formatCop(ing.unit_cost_cents)} / ${ing.unit}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Estado
          </dt>
          <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
            {ing.is_active ? "Activo" : "Inactivo"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Notas
          </dt>
          <dd className="mt-1 text-zinc-700 dark:text-zinc-300">
            {ing.notes.trim() || "—"}
          </dd>
        </div>
      </dl>

      <section className="rounded-xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Usado en recetas
        </h2>
        {recipes.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            Ninguna receta usa este insumo. Se puede eliminar.
          </p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {recipes.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/recipes/${r.id}`}
                  className="font-medium text-[var(--admin-coral-deep)] hover:underline"
                >
                  {r.name}
                </Link>
                <span className="ml-2 text-xs text-zinc-500">
                  {recipeKindLabel(r.kind)} ·{" "}
                  {recipeCategoryLabel(r.category_key)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Productos del menú que lo usan
        </h2>
        {products.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            Ningún ítem del menú enlaza (aún) a esas recetas.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-sm">
            {products.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/admin/products/${p.id}`}
                  className="font-medium text-[var(--admin-coral-deep)] hover:underline"
                >
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
