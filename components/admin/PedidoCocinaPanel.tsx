"use client";

import { useEffect, useState, useTransition } from "react";
import { updatePedidoKitchenStatus } from "@/app/actions/admin/kitchen-status";
import { AdminPortalRoot } from "@/components/admin/AdminPortalRoot";
import {
  KITCHEN_STATUSES,
  kitchenStatusButtonClass,
  kitchenStatusColors,
  kitchenStatusHint,
  kitchenStatusLabel,
  type KitchenStatus,
} from "@/lib/kitchen-status";
import { createPortal } from "react-dom";

export type PedidoRecipePreview = {
  id: string;
  name: string;
  procedureSteps: string[];
  lines: {
    name: string;
    quantity: number;
    unit: string;
    optional: boolean;
  }[];
};

export type PedidoLineRecipe = {
  lineId: string;
  productName: string;
  recipe: PedidoRecipePreview | null;
};

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function PedidoCronometro({
  startedAt,
  stopped,
  stoppedAt,
}: {
  startedAt: string;
  /** Estado final (Servido / Entregado): cronómetro apagado. */
  stopped: boolean;
  /** ISO del momento en que se marcó entregado; congela el elapsed. */
  stoppedAt: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (stopped) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [stopped]);

  const start = new Date(startedAt).getTime();
  const end = stopped
    ? stoppedAt
      ? new Date(stoppedAt).getTime()
      : now
    : now;
  const elapsed =
    Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0;

  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex items-baseline justify-end gap-2">
        <span
          className={[
            "text-[10px] font-semibold uppercase tracking-[0.14em]",
            stopped ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-500",
          ].join(" ")}
        >
          Cronómetro
          {stopped ? " · apagado" : ""}
        </span>
        <span
          className={[
            "text-2xl font-semibold tabular-nums tracking-tight",
            stopped
              ? "text-zinc-400 dark:text-zinc-500"
              : "text-[var(--admin-coral)]",
          ].join(" ")}
          aria-live={stopped ? "off" : "polite"}
        >
          {formatElapsed(elapsed)}
        </span>
      </div>
    </div>
  );
}

export function PedidoCocinaPanel({
  orderId,
  createdAt,
  initialKitchenStatus,
  initialKitchenCompletedAt = null,
  serviceType,
  lineRecipes,
}: {
  orderId: string;
  createdAt: string;
  initialKitchenStatus: KitchenStatus;
  initialKitchenCompletedAt?: string | null;
  serviceType: "domicilio" | "en_el_lugar" | null;
  lineRecipes: PedidoLineRecipe[];
}) {
  const [status, setStatus] = useState<KitchenStatus>(initialKitchenStatus);
  const [kitchenCompletedAt, setKitchenCompletedAt] = useState<string | null>(
    initialKitchenCompletedAt,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [recipeOpen, setRecipeOpen] = useState<PedidoLineRecipe | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  function setKitchen(next: KitchenStatus) {
    if (next === status || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await updatePedidoKitchenStatus(orderId, next);
      if (!res.ok) {
        setError(
          res.error === "forbidden"
            ? "No tenés permiso para cambiar el estado."
            : "No se pudo actualizar el estado de cocina.",
        );
        return;
      }
      setStatus(res.kitchenStatus);
      setKitchenCompletedAt(res.kitchenCompletedAt);
    });
  }

  const cronometroStopped = status === "entregado";

  return (
    <section className="print:hidden rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Cocina
          </p>
          <p
            className={`mt-1 text-lg font-semibold ${kitchenStatusColors(status).title}`}
            data-testid="pedido-cocina-titulo"
          >
            {kitchenStatusLabel(status, serviceType)}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {kitchenStatusHint(status)}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          <PedidoCronometro
            startedAt={createdAt}
            stopped={cronometroStopped}
            stoppedAt={kitchenCompletedAt}
          />
          <div
            className="flex flex-wrap gap-1.5 sm:justify-end"
            data-testid="pedido-cocina-estados"
          >
            {KITCHEN_STATUSES.map((s) => {
              const active = status === s;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={pending}
                  onClick={() => setKitchen(s)}
                  data-testid={`pedido-cocina-btn-${s}`}
                  className={[
                    "rounded-md px-2.5 py-1.5 text-[11px] font-bold tracking-wide transition sm:text-xs",
                    kitchenStatusButtonClass(s, active),
                    pending ? "opacity-70" : "",
                  ].join(" ")}
                >
                  {kitchenStatusLabel(s, serviceType)}
                </button>
              );
            })}
          </div>
          {error ? (
            <p
              className="max-w-xs text-right text-sm text-red-600 dark:text-red-400"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Recetas / preparación
        </p>
        <ul className="mt-2 space-y-2">
          {lineRecipes.map((row) => (
            <li
              key={row.lineId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
            >
              <span className="min-w-0 truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {row.productName}
              </span>
              {row.recipe ? (
                <button
                  type="button"
                  onClick={() => setRecipeOpen(row)}
                  className="shrink-0 rounded-md border border-[var(--admin-coral)]/40 px-2.5 py-1 text-xs font-semibold text-[var(--admin-coral)] transition hover:bg-[color-mix(in_srgb,var(--admin-coral)_10%,transparent)]"
                >
                  Ver receta
                </button>
              ) : (
                <span className="text-xs text-zinc-400">Sin receta</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {mounted && recipeOpen?.recipe
        ? createPortal(
            <AdminPortalRoot>
              <>
                <button
                  type="button"
                  className="fixed inset-x-0 bottom-0 top-14 z-[100] bg-zinc-950/40 backdrop-blur-sm dark:bg-black/50 sm:top-16 lg:left-64"
                  aria-label="Cerrar"
                  onClick={() => setRecipeOpen(null)}
                />
                <div className="pointer-events-none fixed inset-x-0 bottom-0 top-14 z-[101] flex items-center justify-center p-4 sm:top-16 sm:p-6 lg:left-64">
                  <div
                    className="pointer-events-auto relative max-h-[min(85dvh,40rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="pedido-receta-title"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                          Receta · {recipeOpen.productName}
                        </p>
                        <h2
                          id="pedido-receta-title"
                          className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100"
                        >
                          {recipeOpen.recipe.name}
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRecipeOpen(null)}
                        className="rounded-lg p-1.5 text-lg leading-none text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                        aria-label="Cerrar"
                      >
                        ×
                      </button>
                    </div>

                    {recipeOpen.recipe.lines.length > 0 ? (
                      <div className="mt-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                          Ingredientes
                        </p>
                        <ul className="mt-2 space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                          {recipeOpen.recipe.lines.map((l, i) => (
                            <li key={`${l.name}-${i}`} className="flex gap-2">
                              <span className="tabular-nums text-zinc-500">
                                {l.quantity} {l.unit}
                              </span>
                              <span>
                                {l.name}
                                {l.optional ? (
                                  <span className="text-zinc-400"> (opc.)</span>
                                ) : null}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {recipeOpen.recipe.procedureSteps.length > 0 ? (
                      <div className="mt-5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                          Preparación
                        </p>
                        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                          {recipeOpen.recipe.procedureSteps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-zinc-500">
                        Esta receta no tiene pasos de preparación cargados.
                      </p>
                    )}

                    <div className="mt-6 flex justify-end">
                      <a
                        href={`/admin/recipes/${recipeOpen.recipe.id}`}
                        className="text-sm font-medium text-[var(--admin-coral)] underline-offset-2 hover:underline"
                      >
                        Abrir ficha completa
                      </a>
                    </div>
                  </div>
                </div>
              </>
            </AdminPortalRoot>,
            document.body,
          )
        : null}
    </section>
  );
}
