"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { liberarPedidoMesa } from "@/app/actions/admin/pedido-bill";

export function PedidoLiberarMesaBanner({
  orderId,
  mesaLabel,
}: {
  orderId: string;
  mesaLabel: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div
        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 print:hidden dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-100"
        role="status"
        data-testid="pedido-mesa-liberada"
      >
        Mesa {mesaLabel ? `${mesaLabel} ` : ""}liberada. Ya está disponible en
        el salón.
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-[var(--admin-coral)]/35 bg-[color-mix(in_srgb,var(--admin-coral)_8%,white)] px-4 py-3 print:hidden sm:flex-row sm:items-center sm:justify-between dark:bg-[color-mix(in_srgb,var(--admin-coral)_14%,#09090b)]"
      role="status"
      data-testid="pedido-liberar-mesa-banner"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Pedido pagado
          {mesaLabel ? ` · ¿Liberar mesa ${mesaLabel}?` : " · ¿Liberar mesa?"}
        </p>
        <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
          La mesa sigue ocupada. Liberála para que quede disponible en el salón.
        </p>
        {error ? (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        disabled={pending}
        data-testid="pedido-liberar-mesa-btn"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await liberarPedidoMesa(orderId);
            if (!res.ok) {
              setError(
                res.error === "no_mesa"
                  ? "Esta mesa ya está libre."
                  : "No se pudo liberar la mesa.",
              );
              return;
            }
            setDone(true);
            router.refresh();
          });
        }}
        className="shrink-0 rounded-lg bg-[var(--admin-coral)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
      >
        {pending ? "Liberando…" : "Liberar mesa"}
      </button>
    </div>
  );
}
