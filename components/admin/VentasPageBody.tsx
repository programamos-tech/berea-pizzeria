import { Suspense } from "react";
import Link from "next/link";
import {
  VentasFiltersBar,
  VentasRefreshButton,
} from "@/components/admin/VentasFiltersBar";
import { VentasPagination } from "@/components/admin/VentasPagination";
import { VentasSalesTable } from "@/components/admin/VentasSalesTable";
import { withTimeout } from "@/lib/async-timeout";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchAdminVentasPage,
  type VentaOrderRow,
} from "@/lib/supabase/admin-ventas-list";
import { buildAdminVentasListHref } from "@/lib/admin-ventas-list-url";
import type { VentaEstadoFilter, VentaPagoFilter } from "@/lib/ventas-sales";
import {
  adminToolbarBtnActiveClass,
  adminToolbarBtnBaseClass,
  adminPageTitleClass,
  adminPageSubtitleClass,
} from "@/lib/admin-ui";

const VENTAS_PAGE_SIZE = 20;
const VENTAS_FETCH_TIMEOUT_MS = 15_000;

function VentasTableSkeleton() {
  return (
    <div role="status" className="border-t border-zinc-200/70 pt-4 dark:border-zinc-800">
      <p className="mb-3 text-sm text-zinc-500">Cargando ventas…</p>
      <span className="sr-only">Cargando listado de ventas</span>
      <div className="space-y-0 divide-y divide-zinc-100 dark:divide-zinc-800">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex animate-pulse items-center gap-4 py-3 motion-reduce:animate-none"
          >
            <div className="h-4 w-24 rounded bg-zinc-200/80 dark:bg-zinc-700" />
            <div className="h-4 max-w-xs flex-1 rounded bg-zinc-200/60 dark:bg-zinc-700/80" />
            <div className="h-4 w-20 rounded bg-zinc-200/80 dark:bg-zinc-700" />
          </div>
        ))}
      </div>
    </div>
  );
}

export async function VentasPageBody({
  qRaw,
  status,
  payment,
  urlFrom,
  urlTo,
  dateFrom,
  dateTo,
  pageRequested,
}: {
  qRaw: string;
  status: VentaEstadoFilter;
  payment: VentaPagoFilter;
  urlFrom: string | null;
  urlTo: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  pageRequested: number;
}) {
  const supabase = await createSupabaseServerClient();

  let page = pageRequested;
  let pageRows: VentaOrderRow[] = [];
  let totalFiltered = 0;
  let error: string | null = null;

  try {
    const fetched = await withTimeout(
      fetchAdminVentasPage(supabase, {
        q: qRaw,
        status,
        payment,
        dateFrom,
        dateTo,
        page,
        pageSize: VENTAS_PAGE_SIZE,
      }),
      VENTAS_FETCH_TIMEOUT_MS,
    );
    if (!fetched) {
      return (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          La carga de ventas tardó demasiado. Recargá la página o probá de nuevo
          en unos segundos.
        </p>
      );
    }
    ({ rows: pageRows, total: totalFiltered, error } = fetched);
  } catch (err) {
    console.error("[ventas] fetchAdminVentasPage:", err);
    return (
      <p className="text-sm text-amber-700 dark:text-amber-300">
        No se pudieron cargar las ventas. Reintenta o contacta soporte si
        persiste.
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-amber-700 dark:text-amber-300">
        No se pudieron cargar las ventas: {error}
      </p>
    );
  }

  const totalPages = Math.max(1, Math.ceil(totalFiltered / VENTAS_PAGE_SIZE));
  if (page > totalPages && totalFiltered > 0) {
    page = totalPages;
    ({ rows: pageRows, total: totalFiltered } = await fetchAdminVentasPage(
      supabase,
      {
        q: qRaw,
        status,
        payment,
        dateFrom,
        dateTo,
        page,
        pageSize: VENTAS_PAGE_SIZE,
      },
    ));
  }

  const buildPageHref = (p: number) =>
    buildAdminVentasListHref({
      q: qRaw,
      status,
      payment,
      from: urlFrom,
      to: urlTo,
      page: p > 1 ? p : undefined,
    });

  const orderListReturnHref = buildAdminVentasListHref({
    q: qRaw,
    status,
    payment,
    from: urlFrom,
    to: urlTo,
    page,
  });

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <Suspense
        fallback={
          <div role="status" className="h-16 animate-pulse rounded-lg bg-zinc-100/80 dark:bg-zinc-800/60 motion-reduce:animate-none">
            <span className="sr-only">Cargando filtros…</span>
          </div>
        }
      >
        <VentasFiltersBar
          initialQ={qRaw}
          initialFrom={urlFrom ?? ""}
          initialTo={urlTo ?? ""}
        />
      </Suspense>

      <section className="min-h-0 border-t border-zinc-200/70 pt-4 dark:border-zinc-800">
        <VentasSalesTable
          rows={pageRows}
          orderListReturnHref={orderListReturnHref}
        />
        <VentasPagination
          page={page}
          pageSize={VENTAS_PAGE_SIZE}
          total={totalFiltered}
          buildHref={buildPageHref}
        />
      </section>
    </div>
  );
}

export function VentasPageShell({
  qRaw,
  status,
  payment,
  urlFrom,
  urlTo,
  dateFrom,
  dateTo,
  pageRequested,
}: {
  qRaw: string;
  status: VentaEstadoFilter;
  payment: VentaPagoFilter;
  urlFrom: string | null;
  urlTo: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  pageRequested: number;
}) {
  const suspenseKey = `${qRaw}|${status}|${payment}|${dateFrom ?? ""}|${dateTo ?? ""}|${pageRequested}`;

  return (
    <div className="flex w-full min-w-0 max-w-none flex-col gap-4">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 gap-y-2">
        <div className="min-w-0">
          <h1 className={adminPageTitleClass}>
            Pedidos
          </h1>
          <p className={adminPageSubtitleClass}>
            Pedidos del salón y domicilio
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <VentasRefreshButton />
          <Link
            href="/admin/ventas/nueva"
            className={`${adminToolbarBtnBaseClass} ${adminToolbarBtnActiveClass}`}
          >
            + Nuevo pedido
          </Link>
        </div>
      </header>

      <Suspense key={suspenseKey} fallback={<VentasTableSkeleton />}>
        <VentasPageBody
          qRaw={qRaw}
          status={status}
          payment={payment}
          urlFrom={urlFrom}
          urlTo={urlTo}
          dateFrom={dateFrom}
          dateTo={dateTo}
          pageRequested={pageRequested}
        />
      </Suspense>
    </div>
  );
}
