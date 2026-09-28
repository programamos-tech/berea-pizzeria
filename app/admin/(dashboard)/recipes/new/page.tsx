import Link from "next/link";
import { createRecipe } from "@/app/actions/admin/recipes";
import { AdminNewPageShell } from "@/components/admin/AdminNewPageShell";
import { RecipeForm } from "@/components/admin/RecipeForm";
import { fetchAdminIngredients, fetchAdminRecipes } from "@/lib/admin-menu-catalog";
import { requireAdminPermission } from "@/lib/require-admin-permission";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function NewRecipePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPermission("productos_crear");
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;

  const supabase = await createSupabaseServerClient();
  const [ingredients, recipes] = await Promise.all([
    fetchAdminIngredients(supabase),
    fetchAdminRecipes(supabase),
  ]);
  const prepRecipes = recipes
    .filter((r) => r.kind === "prep" && r.is_active)
    .map((r) => ({ id: r.id, name: r.name }));

  return (
    <AdminNewPageShell>
      <div className="mb-6">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          <Link
            href="/admin/recipes"
            className="hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Recetas
          </Link>
          <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">/</span>
          <span className="text-zinc-700 dark:text-zinc-300">Nueva</span>
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-2xl">
          Nueva receta
        </h1>
        <p className="mt-2 max-w-xl text-sm text-zinc-500">
          Definí tipo, rendimiento y líneas BOM con insumos.
        </p>
      </div>

      {error ? (
        <p
          className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/35 dark:text-red-100"
          role="alert"
        >
          {error === "name"
            ? "El nombre es obligatorio."
            : error === "kind"
              ? "Tipo de receta inválido."
              : error === "duplicate"
                ? "Ya existe una receta con ese nombre o slug."
                : error === "lines"
                  ? "La receta se creó pero hubo un error al guardar el BOM."
                  : "No se pudo crear la receta."}
        </p>
      ) : null}

      <RecipeForm
        formAction={createRecipe}
        mode="create"
        cancelHref="/admin/recipes"
        ingredients={ingredients.map((i) => ({
          id: i.id,
          name: i.name,
          unit: i.unit,
        }))}
        prepRecipes={prepRecipes}
      />
    </AdminNewPageShell>
  );
}
