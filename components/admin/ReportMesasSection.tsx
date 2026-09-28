import { MesaFloorIcon } from "@/components/admin/MesaFloorIcon";
import type { DiningTableWithSession } from "@/lib/admin-dining-tables";
import { fetchDiningTablesBoard } from "@/lib/admin-dining-tables";
import { loadAdminPermissions } from "@/lib/load-admin-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Armchair, CircleDot, UtensilsCrossed } from "lucide-react";
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
  if (mins < 1) return "recién";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} m`;
}

function MesaTile({ table }: { table: DiningTableWithSession }) {
  const occupied = Boolean(table.openSession);
  const displayNum = table.code || table.name.replace(/\D+/g, "") || table.name;

  return (
    <li
      className={[
        "relative flex min-h-[7.5rem] flex-col items-center justify-between rounded-2xl border px-2.5 py-3 text-center transition",
        occupied
          ? "border-[color-mix(in_srgb,var(--admin-coral)_45%,#e4e4e7)] bg-[var(--admin-coral-mist)] shadow-[0_1px_0_color-mix(in_srgb,var(--admin-coral)_25%,transparent)] dark:border-[color-mix(in_srgb,var(--admin-coral)_40%,#3f3f46)] dark:bg-[color-mix(in_srgb,var(--admin-coral)_14%,transparent)]"
          : "border-zinc-200/90 bg-white dark:border-zinc-700/80 dark:bg-zinc-900/50",
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]",
          occupied
            ? "bg-[var(--admin-coral)] text-white"
            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
        ].join(" ")}
      >
        {occupied ? (
          <UtensilsCrossed className="size-2.5" strokeWidth={2.4} aria-hidden />
        ) : (
          <CircleDot className="size-2.5" strokeWidth={2.4} aria-hidden />
        )}
        {occupied ? "Ocupada" : "Libre"}
      </span>

      <MesaFloorIcon
        occupied={occupied}
        className={`mt-1 size-12 ${occupied ? "" : "text-zinc-400 dark:text-zinc-500"}`}
      />

      <div className="mt-1 min-w-0 w-full">
        <p
          className={[
            "truncate text-base font-semibold tabular-nums tracking-tight",
            occupied
              ? "text-zinc-900 dark:text-zinc-50"
              : "text-zinc-800 dark:text-zinc-100",
          ].join(" ")}
        >
          {displayNum}
        </p>
        <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
          {table.name}
        </p>
        <p className="mt-0.5 flex items-center justify-center gap-1 truncate text-[10px] text-zinc-500 dark:text-zinc-400">
          <Armchair className="size-3 shrink-0 opacity-70" aria-hidden />
          <span className="truncate">
            {occupied && table.openSession?.guestCount
              ? `${table.openSession.guestCount} comensal${table.openSession.guestCount === 1 ? "" : "es"}`
              : seatsLabel(table.seats)}
            {occupied && table.openSession
              ? ` · ${openedAgo(table.openSession.openedAt)}`
              : ""}
          </span>
        </p>
        {occupied && table.openSession?.note?.trim() ? (
          <p className="mt-0.5 truncate text-[10px] font-medium text-[var(--admin-coral-deep)] dark:text-[var(--admin-coral-soft)]">
            {table.openSession.note.trim()}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function ReportMesasSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" role="status">
      <div className="h-8 w-48 animate-pulse rounded bg-zinc-100/50 dark:bg-zinc-900/50" />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-[7.5rem] animate-pulse rounded-2xl bg-zinc-100/40 dark:bg-zinc-900/40"
          />
        ))}
      </div>
      <span className="sr-only">Cargando mapa de mesas…</span>
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

  const tables = board.all;
  const free = board.available.length;
  const busy = board.occupied.length;

  if (tables.length === 0) {
    return (
      <div className="flex min-h-[12rem] flex-col justify-center">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Mapa de mesas
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          Aún no hay mesas configuradas en esta sucursal.
        </p>
      </div>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Mapa de mesas
          </h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Salón · sucursal activa · estado en tiempo real
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-300">
            <span className="inline-flex size-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            <span className={labelClass}>
              <span className="normal-case tracking-normal text-zinc-600 dark:text-zinc-300">
                <span className="tabular-nums font-semibold">{free}</span> libre
                {free === 1 ? "" : "s"}
              </span>
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-300">
            <span className="inline-flex size-2.5 rounded-full bg-[var(--admin-coral)]" />
            <span className="tabular-nums font-semibold text-zinc-700 dark:text-zinc-200">
              {busy}
            </span>{" "}
            ocupada{busy === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div
        className="mt-3 rounded-2xl border border-zinc-200/80 bg-[radial-gradient(circle_at_1px_1px,#e4e4e7_1px,transparent_0)] bg-[length:14px_14px] p-3 dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_1px_1px,#3f3f46_1px,transparent_0)] dark:bg-[length:14px_14px] sm:p-4"
        role="list"
        aria-label="Mapa de mesas del salón"
      >
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {tables.map((t) => (
            <MesaTile key={t.id} table={t} />
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Mapa visual de mesas en Reportes (libres vs ocupadas). */
export function ReportMesasSection() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<ReportMesasSkeleton />}>
        <ReportMesasBoard />
      </Suspense>
    </div>
  );
}
