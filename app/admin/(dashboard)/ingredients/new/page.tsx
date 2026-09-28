import Link from "next/link";
import { createIngredient } from "@/app/actions/admin/ingredients";
import { AdminNewPageShell } from "@/components/admin/AdminNewPageShell";
import { IngredientForm } from "@/components/admin/IngredientForm";
import { requireAdminPermission } from "@/lib/require-admin-permission";

export default async function NewIngredientPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPermission("productos_crear");
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;

  return (
    <AdminNewPageShell>
      <div className="mb-6 flex min-w-0 flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <Link
              href="/admin/ingredients"
              className="hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Insumos
            </Link>
            <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">/</span>
            <span className="text-zinc-700 dark:text-zinc-300">Nuevo</span>
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-2xl">
            Nuevo insumo
          </h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
            Nombre, unidad y costo opcional para estimar recetas.
          </p>
        </div>
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
              : error === "duplicate"
                ? "Ya existe un insumo con ese nombre o código."
                : "No se pudo crear el insumo. Intentá de nuevo."}
        </p>
      ) : null}

      <IngredientForm
        formAction={createIngredient}
        mode="create"
        cancelHref="/admin/ingredients"
      />
    </AdminNewPageShell>
  );
}
