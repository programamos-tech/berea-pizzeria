"use client";

import { Package } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { addIngredientStockEntry } from "@/app/actions/admin/ingredients";
import {
  formatCop,
  formatCopInputGrouping,
  parseCopInputDigitsToInt,
  sanitizeCopIntegerTyping,
} from "@/lib/money";

const actionBtnClass =
  "inline-flex size-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

type CostEditMode = "total" | "unit";

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
  const [totalRaw, setTotalRaw] = useState("");
  const [unitRaw, setUnitRaw] = useState("");
  const [costMode, setCostMode] = useState<CostEditMode>("total");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stock, setStock] = useState(stockQty);
  const [pending, startTransition] = useTransition();

  const qtyNum = useMemo(() => {
    const n = Number(String(qty).replace(",", ".").trim());
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [qty]);

  const totalPesos = useMemo(
    () => parseCopInputDigitsToInt(totalRaw),
    [totalRaw],
  );
  const unitPesos = useMemo(
    () => parseCopInputDigitsToInt(unitRaw),
    [unitRaw],
  );

  const derivedUnit =
    qtyNum > 0 && totalPesos > 0 ? Math.round(totalPesos / qtyNum) : 0;
  const derivedTotal =
    qtyNum > 0 && unitPesos > 0 ? Math.round(unitPesos * qtyNum) : 0;

  const displayUnitPesos = costMode === "total" ? derivedUnit : unitPesos;
  const displayTotalPesos = costMode === "unit" ? derivedTotal : totalPesos;

  function resetForm() {
    setQty("");
    setTotalRaw("");
    setUnitRaw("");
    setCostMode("total");
    setNote("");
    setError(null);
  }

  function onQtyChange(raw: string) {
    setQty(raw);
    if (costMode === "unit" && unitPesos > 0) {
      const n = Number(String(raw).replace(",", ".").trim());
      if (Number.isFinite(n) && n > 0) {
        setTotalRaw(formatCopInputGrouping(Math.round(unitPesos * n)));
      }
    }
  }

  function onTotalChange(raw: string) {
    setCostMode("total");
    const sanitized = sanitizeCopIntegerTyping(raw);
    setTotalRaw(sanitized);
    const total = parseCopInputDigitsToInt(sanitized);
    if (qtyNum > 0 && total > 0) {
      setUnitRaw(formatCopInputGrouping(Math.round(total / qtyNum)));
    } else if (!sanitized) {
      setUnitRaw("");
    }
  }

  function onUnitChange(raw: string) {
    setCostMode("unit");
    const sanitized = sanitizeCopIntegerTyping(raw);
    setUnitRaw(sanitized);
    const unitCost = parseCopInputDigitsToInt(sanitized);
    if (qtyNum > 0 && unitCost > 0) {
      setTotalRaw(formatCopInputGrouping(Math.round(unitCost * qtyNum)));
    } else if (!sanitized) {
      setTotalRaw("");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("ingredient_id", ingredientId);
    fd.set("quantity", qty);
    fd.set("kind", "purchase");
    if (displayTotalPesos > 0) {
      fd.set("total_cost_cents", String(displayTotalPesos));
    }
    if (displayUnitPesos > 0) {
      fd.set("unit_cost_cents", String(displayUnitPesos));
    }
    fd.set("note", note);
    startTransition(async () => {
      const result = await addIngredientStockEntry(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStock(result.stockQty);
      resetForm();
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
                onChange={(e) => onQtyChange(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[var(--admin-coral)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                autoFocus
              />
            </label>

            <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Valor total de la compra (COP)
              <input
                type="text"
                inputMode="numeric"
                value={totalRaw}
                onChange={(e) => onTotalChange(e.target.value)}
                placeholder="ej. 1.800.000"
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[var(--admin-coral)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <p className="mt-1.5 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
              Si compraste 2 botellas a $900.000 c/u, cantidad 2 y total
              $1.800.000 → costo unitario $900.000.
            </p>

            <div className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
              <div className="flex items-baseline justify-between gap-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Costo unitario (COP / {unit})
                </label>
                {displayUnitPesos > 0 ? (
                  <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {formatCop(displayUnitPesos)}
                  </span>
                ) : (
                  <span className="text-xs text-zinc-400">—</span>
                )}
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={unitRaw}
                onChange={(e) => onUnitChange(e.target.value)}
                placeholder="Se calcula solo: total ÷ cantidad"
                aria-label={`Costo unitario COP por ${unit}`}
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[var(--admin-coral)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                {costMode === "total"
                  ? "Se calcula al escribir el total. Podés editarlo y se ajusta el total."
                  : displayTotalPesos > 0
                    ? `Total recalculado: ${formatCop(displayTotalPesos)}`
                    : "Editá el unitario o volvé al total de la compra."}
              </p>
            </div>

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
              <p
                className="mt-3 text-sm text-red-600 dark:text-red-400"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!pending) {
                    resetForm();
                    setOpen(false);
                  }
                }}
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
