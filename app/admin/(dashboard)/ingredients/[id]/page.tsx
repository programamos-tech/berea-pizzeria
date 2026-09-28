import Link from "next/link";
import { notFound } from "next/navigation";
import { IngredientDeleteConfirm } from "@/components/admin/IngredientDeleteConfirm";
import { IngredientStockEntryButton } from "@/components/admin/IngredientStockEntryButton";
import { fetchAdminIngredientById } from "@/lib/admin-menu-catalog";
import { loadAdminPermissions } from "@/lib/load-admin-permissions";
import { formatCop } from "@/lib/money";
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
    .select("recipe_id, recipes(id, name)")
    .eq("ingredient_id", id)
    .limit(20);

  const recipeNames = [
    ...new Set(
      (recipeRows ?? [])
        .map((row) => {
          const r = row.recipes as
            | { id: string; name: string }
            | { id: string; name: string }[]
            | null;
          const one = Array.isArray(r) ? r[0] : r;
          return one?.name?.trim() || null;
        })
        .filter((n): n is string => Boolean(n)),
    ),
  ];

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
        {recipeNames.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            Ninguna receta usa este insumo. Se puede eliminar.
          </p>
        ) : (
          <ul className="mt-2 list-inside list-disc text-sm text-zinc-700 dark:text-zinc-300">
            {recipeNames.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
