import Link from "next/link";
import { notFound } from "next/navigation";
import { updateRecipe } from "@/app/actions/admin/recipes";
import { RecipeForm } from "@/components/admin/RecipeForm";
import {
  fetchAdminIngredients,
  fetchAdminRecipeDetail,
  fetchAdminRecipes,
} from "@/lib/admin-menu-catalog";
import { requireAdminPermission } from "@/lib/require-admin-permission";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EditRecipePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPermission("productos_editar");
  const { id } = await params;
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;

  const supabase = await createSupabaseServerClient();
  const [detail, ingredients, recipes] = await Promise.all([
    fetchAdminRecipeDetail(supabase, id),
    fetchAdminIngredients(supabase),
    fetchAdminRecipes(supabase),
  ]);
  if (!detail) notFound();

  const { recipe, lines } = detail;
  const prepRecipes = recipes
    .filter((r) => r.kind === "prep" && r.is_active && r.id !== id)
    .map((r) => ({ id: r.id, name: r.name }));

  const boundUpdate = updateRecipe.bind(null, id);

  return (
    <div className="w-full min-w-0">
      <div className="mb-6">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          <Link
            href="/admin/recipes"
            className="hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Recetas
          </Link>
          <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">/</span>
          <Link
            href={`/admin/recipes/${id}`}
            className="hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            {recipe.name}
          </Link>
          <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">/</span>
          <span className="text-zinc-700 dark:text-zinc-300">Editar</span>
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-2xl">
          Editar receta
        </h1>
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
              : error === "lines"
                ? "No se pudo guardar el BOM. Revisá las líneas."
                : "No se pudo guardar."}
        </p>
      ) : null}

      <RecipeForm
        formAction={boundUpdate}
        mode="edit"
        cancelHref={`/admin/recipes/${id}`}
        ingredients={ingredients.map((i) => ({
          id: i.id,
          name: i.name,
          unit: i.unit,
        }))}
        prepRecipes={prepRecipes}
        initial={{
          name: String(recipe.name),
          kind: String(recipe.kind),
          categoryKey: String(recipe.category_key),
          yieldQty: String(recipe.yield_qty),
          yieldUnit: String(recipe.yield_unit),
          procedureText: String(recipe.procedure_text ?? ""),
          isActive: Boolean(recipe.is_active),
          lines: lines.map((line) => ({
            ingredientId: String(line.ingredient_id ?? ""),
            componentRecipeId: String(line.component_recipe_id ?? ""),
            quantity: String(line.quantity ?? ""),
            unit: String(line.unit ?? "g"),
            optional: Boolean(line.is_optional),
            note: String(line.note ?? ""),
          })),
        }}
      />
    </div>
  );
}
