import { fetchDiningTablesBoard } from "@/lib/admin-dining-tables";
import { loadAdminPermissions } from "@/lib/load-admin-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Suspense } from "react";

const labelClass =
  "text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-500";

function seatsLabel(n: number): string {
  if (n <= 0) return "";
  return n === 1 ? "1 puesto" : `${n} puestos`;
}

function openedAgo(iso: string): string {
  const opened = new Date(iso).getTime();
  if (!Number.isFinite(opened)) return "";
  const mins = Math.max(0, Math.round((Date.now() - opened) / 60_000));
  if (mins < 1) return "recién abierta";
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return h === 1 ? "hace 1 h" : `hace ${h} h`;
  return `hace ${h} h ${m} min`;
}

function MesaChip({
  name,
  meta,
  tone,
}: {
  name: string;
  meta: string;
  tone: "free" | "busy";
}) {
  const toneClass =
    tone === "free"
      ? "border-emerald-200/90 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-100"
      : "border-[color-mix(in_srgb,var(--admin-coral)_35%,transparent)] bg-[var(--admin-coral-mist)] text-zinc-900 dark:border-[color-mix(in_srgb,var(--admin-coral)_40%,transparent)] dark:bg-[color-mix(in_srgb,var(--admin-coral)_18%,transparent)] dark:text-zinc-100";

  return (
    <li
      className={`flex min-w-0 flex-col rounded-xl border px-3 py-2.5 ${toneClass}`}
    >
      <span className="truncate text-sm font-semibold tracking-tight">{name}</span>
      {meta ? (
        <span className="mt-0.5 truncate text-[11px] opacity-80">{meta}</span>
      ) : null}
    </li>
  );
}

export function ReportMesasSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5" role="status">
      <div className="h-28 animate-pulse rounded-xl bg-zinc-100/40 dark:bg-zinc-900/40" />
      <div className="h-28 animate-pulse rounded-xl bg-zinc-100/40 dark:bg-zinc-900/40" />
      <span className="sr-only">Cargando mesas…</span>
    </div>
  );
}

async function ReportMesasBoard() {
  const perm = await loadAdminPermissions();
  if (!perm?.branchContext) {
    return (
      <p className="text-sm text-zinc-500">
        No hay sucursal activa para ver mesas.
      </p>
    );
  }

  const supabase = await createSupabaseServerClient();
  const board = await fetchDiningTablesBoard(
    supabase,
    perm.branchContext.active.id,
  );

  const free = board.available;
  const busy = board.occupied;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <section className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Mesas disponibles
          </h2>
          <span className={labelClass}>
            <span className="tabular-nums">{free.length}</span> libre
            {free.length === 1 ? "" : "s"}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Sin pedido abierto en la sucursal activa
        </p>
        {free.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            No hay mesas libres ahora.
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {free.map((t) => (
              <MesaChip
                key={t.id}
                name={t.name}
                meta={seatsLabel(t.seats)}
                tone="free"
              />
            ))}
          </ul>
        )}
      </section>

      <section className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Mesas con pedidos
          </h2>
          <span className={labelClass}>
            <span className="tabular-nums">{busy.length}</span> con pedido
            {busy.length === 1 ? "" : "s"}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Pedido abierto · en curso
        </p>
        {busy.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            Ninguna mesa tiene pedido abierto.
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {busy.map((t) => {
              const parts = [
                seatsLabel(t.seats),
                t.openSession?.guestCount
                  ? `${t.openSession.guestCount} comensal${t.openSession.guestCount === 1 ? "" : "es"}`
                  : null,
                t.openSession ? openedAgo(t.openSession.openedAt) : null,
                t.openSession?.note?.trim() || null,
              ].filter(Boolean);
              return (
                <MesaChip
                  key={t.id}
                  name={t.name}
                  meta={parts.join(" · ")}
                  tone="busy"
                />
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Sustituye el bloque Ingresos vs egresos + tops en Reportes. */
export function ReportMesasSection() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<ReportMesasSkeleton />}>
        <ReportMesasBoard />
      </Suspense>
    </div>
  );
}
