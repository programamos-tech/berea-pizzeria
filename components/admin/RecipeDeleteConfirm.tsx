"use client";

import { Trash2 } from "lucide-react";
import { useRef, useTransition } from "react";
import { deleteRecipe } from "@/app/actions/admin/recipes";
import { adminButtonCancelClass } from "@/lib/admin-ui";

const dialogClass =
  "fixed left-1/2 top-1/2 z-[200] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-2xl max-h-[min(90dvh,100%)] overflow-y-auto dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 [&::backdrop]:bg-zinc-950/50";

const actionBtnClass =
  "inline-flex size-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40 dark:text-zinc-400 dark:hover:bg-red-950/40 dark:hover:text-red-300";

export function RecipeDeleteConfirm({
  recipeId,
  recipeName,
  variant = "icon",
}: {
  recipeId: string;
  recipeName: string;
  variant?: "icon" | "button";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          className={actionBtnClass}
          title="Eliminar receta"
          aria-label="Eliminar"
          onClick={() => dialogRef.current?.showModal()}
        >
          <Trash2 className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900/60 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950/40"
          onClick={() => dialogRef.current?.showModal()}
        >
          Eliminar
        </button>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={`rec-del-${recipeId}`}
        className={dialogClass}
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
      >
        <h2
          id={`rec-del-${recipeId}`}
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
        >
          ¿Eliminar esta receta?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          Se va a borrar{" "}
          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
            «{recipeName}»
          </span>
          . Si está vinculada a un ítem del menú o a otra receta, la eliminación
          se bloqueará.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            className={adminButtonCancelClass}
            onClick={() => {
              if (!pending) dialogRef.current?.close();
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending}
            className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
            onClick={() => {
              startTransition(() => {
                void deleteRecipe(recipeId);
              });
            }}
          >
            {pending ? "Eliminando…" : "Sí, eliminar"}
          </button>
        </div>
      </dialog>
    </>
  );
}
