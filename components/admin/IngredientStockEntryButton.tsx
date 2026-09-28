"use client";

import { Package } from "lucide-react";
import { useState, useTransition } from "react";
import { addIngredientStockEntry } from "@/app/actions/admin/ingredients";

const actionBtnClass =
  "inline-flex size-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

export function IngredientStockEntryButton({
  ingredientId,
  ingredientName,
  unit,
  stockQty,
  variant = "label",
}: {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  stockQty: number;
  /** `icon` = Menú-style action; `label` = text Entrada button. */
  variant?: "label" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stock, setStock] = useState(stockQty);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("ingredient_id", ingredientId);
    fd.set("quantity", qty);
    fd.set("unit_cost_cents", cost);
    fd.set("note", note);
    fd.set("kind", "purchase");
    startTransition(async () => {
      const result = await addIngredientStockEntry(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStock(result.stockQty);
      setQty("");
      setCost("");
      setNote("");
      setOpen(false);
    });
  }

  const trigger =
    variant === "icon" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={actionBtnClass}
        title="Entrada de stock"
        aria-label="Entrada"
      >
        <Package className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        Entrada
      </button>
    );

  return (
    <>
      {variant === "label" ? (
        <div className="flex items-center justify-end gap-2">
          <span className="font-mono text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
            {Number(stock).toLocaleString("es-CO", { maximumFractionDigits: 2 })}{" "}
            {unit}
          </span>
          {trigger}
        </div>
      ) : (
        trigger
      )}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Entrada de stock · ${ingredientName}`}
          onClick={(ev) => {
            if (ev.target === ev.currentTarget && !pending) setOpen(false);
          }}
        >
          <form
            onSubmit={submit}
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-950"
          >
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Registrar compra / entrada
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {ingredientName} · stock actual{" "}
              <span className="font-mono tabular-nums">
                {Number(stock).toLocaleString("es-CO", {
                  maximumFractionDigits: 2,
                })}{" "}
                {unit}
              </span>
            </p>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Cantidad ({unit})
              <input
                type="number"
                step="any"
                min="0"
                required
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[var(--admin-coral)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                autoFocus
              />
            </label>

            <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Costo unitario COP (opcional)
              <input
                type="text"
                inputMode="numeric"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="ej. 2500"
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[var(--admin-coral)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>

            <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Nota (opcional)
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Proveedor, factura…"
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[var(--admin-coral)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>

            {error ? (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-[var(--admin-coral)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--admin-coral-hover)] disabled:opacity-60"
              >
                {pending ? "Guardando…" : "Sumar al stock"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
