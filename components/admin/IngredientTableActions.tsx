"use client";

import Link from "next/link";
import { Eye, Pencil } from "lucide-react";
import { IngredientDeleteConfirm } from "@/components/admin/IngredientDeleteConfirm";
import { IngredientStockEntryButton } from "@/components/admin/IngredientStockEntryButton";

const actionBtnClass =
  "inline-flex size-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

const actionIconClass = "size-4 shrink-0";

export function IngredientTableActions({
  ingredientId,
  ingredientName,
  unit,
  stockQty,
  canEdit,
  canStock,
}: {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  stockQty: number;
  canEdit: boolean;
  canStock: boolean;
}) {
  return (
    <div className="flex shrink-0 flex-nowrap items-center justify-end gap-0.5">
      <Link
        href={`/admin/ingredients/${ingredientId}`}
        className={actionBtnClass}
        title="Ver detalle"
        aria-label="Ver detalle"
      >
        <Eye className={actionIconClass} strokeWidth={1.75} aria-hidden />
      </Link>
      {canEdit ? (
        <Link
          href={`/admin/ingredients/${ingredientId}/edit`}
          className={actionBtnClass}
          title="Editar insumo"
          aria-label="Editar"
        >
          <Pencil className={actionIconClass} strokeWidth={1.75} aria-hidden />
        </Link>
      ) : null}
      {canEdit ? (
        <IngredientDeleteConfirm
          ingredientId={ingredientId}
          ingredientName={ingredientName}
        />
      ) : null}
      {canStock ? (
        <IngredientStockEntryButton
          ingredientId={ingredientId}
          ingredientName={ingredientName}
          unit={unit}
          stockQty={stockQty}
          variant="icon"
        />
      ) : null}
    </div>
  );
}
