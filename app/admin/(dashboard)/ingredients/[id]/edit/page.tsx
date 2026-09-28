import Link from "next/link";
import { notFound } from "next/navigation";
import { updateIngredient } from "@/app/actions/admin/ingredients";
import { IngredientForm } from "@/components/admin/IngredientForm";
import { fetchAdminIngredientById } from "@/lib/admin-menu-catalog";
import { requireAdminPermission } from "@/lib/require-admin-permission";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EditIngredientPage({
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
  const ing = await fetchAdminIngredientById(supabase, id);
  if (!ing) notFound();

  const boundUpdate = updateIngredient.bind(null, id);

  return (
    <div className="w-full min-w-0">
      <div className="mb-6">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          <Link
            href="/admin/ingredients"
            className="hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Insumos
          </Link>
          <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">/</span>
          <Link
            href={`/admin/ingredients/${id}`}
            className="hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            {ing.name}
          </Link>
          <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">/</span>
          <span className="text-zinc-700 dark:text-zinc-300">Editar</span>
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-2xl">
          Editar insumo
        </h1>
      </div>

      {error ? (
        <p
          className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/35 dark:text-red-100"
          role="alert"
        >
          {error === "name"
            ? "El nombre es obligatorio."
            : error === "unit"
              ? "Elegí una unidad válida."
              : "No se pudo guardar. Intentá de nuevo."}
        </p>
      ) : null}

      <IngredientForm
        formAction={boundUpdate}
        mode="edit"
        cancelHref={`/admin/ingredients/${id}`}
        initial={{
          name: ing.name,
          unit: ing.unit,
          notes: ing.notes,
          unitCostCents: ing.unit_cost_cents,
          isActive: ing.is_active,
        }}
      />
    </div>
  );
}
