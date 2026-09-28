import Link from "next/link";

export type ProductRecipeBomLine = {
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

export type ProductRecipeVariantRow = {
  id: string;
  variant_key: string;
  label: string;
  recipe_id: string;
  recipe_name: string | null;
};

type Props = {
  recipe: {
    id: string;
    name: string;
    kind: string;
    category_key: string;
  } | null;
  lines: ProductRecipeBomLine[];
  variants: ProductRecipeVariantRow[];
  kindLabel: (kind: string) => string;
  categoryLabel: (key: string) => string;
};

export function ProductRecipeBomSection({
  recipe,
  lines,
  variants,
  kindLabel,
  categoryLabel,
}: Props) {
  if (!recipe && variants.length === 0) {
    return (
      <section className="rounded-xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Receta / BOM
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          Sin receta vinculada (reventa / producto simple).
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Receta / BOM
        </h2>
        {recipe ? (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            <Link
              href={`/admin/recipes/${recipe.id}`}
              className="font-medium text-[var(--admin-coral-deep)] hover:underline"
            >
              {recipe.name}
            </Link>
            <span className="text-zinc-400"> · </span>
            {kindLabel(recipe.kind)}
            <span className="text-zinc-400"> · </span>
            {categoryLabel(recipe.category_key)}
          </p>
        ) : null}
      </div>

      {variants.length > 0 ? (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Variantes
          </h3>
          <ul className="mt-1.5 space-y-1 text-sm">
            {variants.map((v) => (
              <li key={v.id}>
                <span className="text-zinc-700 dark:text-zinc-300">
                  {v.label}
                </span>
                {v.recipe_id ? (
                  <>
                    <span className="text-zinc-400"> · </span>
                    <Link
                      href={`/admin/recipes/${v.recipe_id}`}
                      className="text-[var(--admin-coral-deep)] hover:underline"
                    >
                      {v.recipe_name || "Ver receta"}
                    </Link>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {recipe ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className="pb-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Componente
                </th>
                <th className="pb-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Cantidad
                </th>
                <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Nota
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const isIng = Boolean(line.ingredient_id);
                const href = isIng
                  ? `/admin/ingredients/${line.ingredient_id}`
                  : line.component_recipe_id
                    ? `/admin/recipes/${line.component_recipe_id}`
                    : null;
                const label =
                  line.ingredient_name || line.component_name || "—";
                return (
                  <tr
                    key={line.id}
                    className="border-b border-zinc-50 last:border-0 dark:border-zinc-900"
                  >
                    <td className="py-2 pr-4 font-medium text-zinc-800 dark:text-zinc-100">
                      {href ? (
                        <Link
                          href={href}
                          className="hover:underline"
                        >
                          {label}
                        </Link>
                      ) : (
                        label
                      )}
                      {line.is_optional ? (
                        <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-400">
                          opcional
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-zinc-600 dark:text-zinc-300">
                      {Number(line.quantity)} {line.unit}
                    </td>
                    <td className="py-2 text-zinc-500">{line.note || "—"}</td>
                  </tr>
                );
              })}
              {lines.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="py-6 text-center text-zinc-500"
                  >
                    Sin líneas BOM (reventa).
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
