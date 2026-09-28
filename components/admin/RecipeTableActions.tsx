"use client";

import Link from "next/link";
import { Eye, Pencil, UtensilsCrossed } from "lucide-react";
import { RecipeDeleteConfirm } from "@/components/admin/RecipeDeleteConfirm";

const actionBtnClass =
  "inline-flex size-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

const actionIconClass = "size-4 shrink-0";

export function RecipeTableActions({
  recipeId,
  recipeName,
  linkedProductId,
  canEdit,
}: {
  recipeId: string;
  recipeName: string;
  linkedProductId: string | null;
  canEdit: boolean;
}) {
  return (
    <div className="flex shrink-0 flex-nowrap items-center justify-end gap-0.5">
      <Link
        href={`/admin/recipes/${recipeId}`}
        className={actionBtnClass}
        title="Ver detalle"
        aria-label="Ver detalle"
      >
        <Eye className={actionIconClass} strokeWidth={1.75} aria-hidden />
      </Link>
      {canEdit ? (
        <Link
          href={`/admin/recipes/${recipeId}/edit`}
          className={actionBtnClass}
          title="Editar receta"
          aria-label="Editar"
        >
          <Pencil className={actionIconClass} strokeWidth={1.75} aria-hidden />
        </Link>
      ) : null}
      {linkedProductId ? (
        <Link
          href={`/admin/products/${linkedProductId}`}
          className={actionBtnClass}
          title="Ver ítem del menú"
          aria-label="Ver menú"
        >
          <UtensilsCrossed
            className={actionIconClass}
            strokeWidth={1.75}
            aria-hidden
          />
        </Link>
      ) : null}
      {canEdit ? (
        <RecipeDeleteConfirm recipeId={recipeId} recipeName={recipeName} />
      ) : null}
    </div>
  );
}
