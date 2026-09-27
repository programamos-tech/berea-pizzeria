import { Suspense } from "react";
import { ReportsPeriodFilter } from "@/components/admin/ReportsPeriodFilter";
import { ReportsMonthFilter } from "@/components/admin/ReportsMonthFilter";
import { ReportsVistaFilter } from "@/components/admin/ReportsVistaFilter";
import { ReportsAleyaExportButton } from "@/components/admin/ReportsAleyaExportButton";
import { ReportsDashboardBody } from "@/components/admin/ReportsDashboardBody";
import { ReportsHeaderMeta } from "@/components/admin/ReportsHeaderMeta";
import { ReportsRefreshButton } from "@/components/admin/ReportsRefreshButton";
import {
  ReportsNavPendingProvider,
  ReportsPendingSwap,
} from "@/components/admin/ReportsNavPending";
import { ReportsNavPendingBadge } from "@/components/admin/ReportsNavPendingBadge";
import {
  ReportActivityFeed,
  ReportActivityFeedSkeleton,
} from "@/components/admin/ReportActivityFeed";
import { ReportMesasSection } from "@/components/admin/ReportMesasSection";
import {
  currentYearMonthInReportStore,
  parseReportRangeFromSearchParams,
  parseReportTiendaMonthFromSearchParams,
  parseReportVistaFromSearchParams,
  prettyReportPeriodLabel,
  prettyYearMonthLabel,
  reportTiendaMonthRange,
  todayYmdInReportStore,
} from "@/lib/admin-report-range";
import { adminLandingPath } from "@/lib/admin-landing";
import { loadAdminPermissions } from "@/lib/load-admin-permissions";
import { adminPageTitleClass } from "@/lib/admin-ui";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Mobile/iPad: scroll de página (sin lock). Desktop xl+: alto de viewport con scroll interno si hace falta. */
const reportsViewportClass =
  "flex w-full min-w-0 max-w-full flex-col gap-3 overflow-x-clip pb-8 xl:h-[calc(100dvh-4rem-3rem)] xl:min-h-0 xl:flex-1 xl:gap-2.5 xl:overflow-y-auto xl:overscroll-y-contain xl:pb-0";

function ReportsKpisSkeleton() {
  return (
    <div
      className="grid shrink-0 grid-cols-2 gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-5 md:grid-cols-3 xl:grid-cols-6"
      role="status"
    >
      <span className="sr-only">Cargando métricas…</span>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-lg bg-zinc-100/50 dark:bg-zinc-900/50 motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

export default async function AdminHomePage({ searchParams }: PageProps) {
  const perm = await loadAdminPermissions();
  if (!perm) redirect("/admin/login");
  if (!perm.permissions.inicio_reportes) {
    redirect(adminLandingPath(perm.permissions));
  }

  const sp = await searchParams;
  const todayKey = todayYmdInReportStore();
  const canSeeTiendaVista = Boolean(perm.permissions.reportes_tienda);
  const vistaRaw = parseReportVistaFromSearchParams(sp);
  if (!canSeeTiendaVista && vistaRaw === "tienda") {
    redirect(`/admin?vista=dia&from=${todayKey}&to=${todayKey}`);
  }
  const currentYm = currentYearMonthInReportStore();
  const vista = canSeeTiendaVista ? vistaRaw : "dia";
  const tiendaYm = parseReportTiendaMonthFromSearchParams(sp, todayKey);
  const urlRange = parseReportRangeFromSearchParams(sp, todayKey);
  const { from: rangeFrom, to: rangeTo } =
    vista === "tienda"
      ? reportTiendaMonthRange(tiendaYm, todayKey)
      : urlRange;
  const isCurrentTiendaMonth = vista === "tienda" && tiendaYm === currentYm;
  const periodLabel =
    vista === "tienda"
      ? isCurrentTiendaMonth
        ? `${prettyYearMonthLabel(tiendaYm)} · hasta hoy`
        : prettyYearMonthLabel(tiendaYm)
      : prettyReportPeriodLabel(rangeFrom, rangeTo, todayKey);
  // Solo el rango elegido: el gráfico de tendencia semanal ya no se muestra,
  // y ampliar fetch a 14 días extras ralentizaba el RPC de KPIs.
  const fetchFrom = rangeFrom;
  const fetchTo = rangeTo;
  const dashChartFrom = rangeFrom;
  const dashChartTo = rangeTo;
  const dashTrendCurrentFrom = rangeFrom;
  const dashTrendCurrentTo = rangeTo;
  const dashTrendPriorFrom = rangeFrom;
  const dashTrendPriorTo = rangeTo;

  const streamKey = `${vista}-${rangeFrom}-${rangeTo}`;

  return (
    <Suspense fallback={<div className={reportsViewportClass} />}>
      <ReportsNavPendingProvider>
        <div className={reportsViewportClass}>
          <header className="flex w-full shrink-0 flex-col gap-3 xl:flex-row xl:items-start xl:justify-between xl:gap-6">
            <div className="min-w-0 xl:max-w-md 2xl:max-w-lg">
              <h1 className={`leading-none ${adminPageTitleClass}`}>Reportes</h1>
              <ReportsHeaderMeta
                vista={vista}
                periodLabel={periodLabel}
                isCurrentTiendaMonth={isCurrentTiendaMonth}
              />
            </div>
            <div className="flex w-full min-w-0 max-w-full flex-wrap items-center gap-2 xl:w-auto xl:flex-1 xl:flex-nowrap xl:justify-end">
              <ReportsVistaFilter
                vista={vista}
                todayKey={todayKey}
                allowTiendaVista={canSeeTiendaVista}
              />
              {vista === "tienda" ? (
                <ReportsMonthFilter
                  selectedYm={tiendaYm}
                  currentYm={currentYm}
                />
              ) : (
                <ReportsPeriodFilter
                  rangeFrom={rangeFrom}
                  rangeTo={rangeTo}
                  todayKey={todayKey}
                />
              )}
              <ReportsAleyaExportButton
                defaultYearMonth={
                  rangeFrom.slice(0, 7) === rangeTo.slice(0, 7)
                    ? rangeFrom.slice(0, 7)
                    : currentYm
                }
              />
              <ReportsRefreshButton />
              <ReportsNavPendingBadge />
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-4 max-xl:flex-none">
            {/* Solo KPIs esperan el cambio de vista/rango; gráfica y actividad siguen visibles. */}
            <ReportsPendingSwap fallback={<ReportsKpisSkeleton />}>
              <Suspense
                key={`kpis-${streamKey}`}
                fallback={<ReportsKpisSkeleton />}
              >
                <ReportsDashboardBody
                  rangeFrom={rangeFrom}
                  rangeTo={rangeTo}
                  chartFrom={dashChartFrom}
                  chartTo={dashChartTo}
                  salesTrendCurrentFrom={dashTrendCurrentFrom}
                  salesTrendCurrentTo={dashTrendCurrentTo}
                  salesTrendPriorFrom={dashTrendPriorFrom}
                  salesTrendPriorTo={dashTrendPriorTo}
                  fetchFrom={fetchFrom}
                  fetchTo={fetchTo}
                  periodLabel={periodLabel}
                  todayKey={todayKey}
                  vista={vista}
                />
              </Suspense>
            </ReportsPendingSwap>

            <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-5 border-t border-zinc-200/70 pt-4 dark:border-zinc-800 max-xl:flex-none lg:grid-cols-12 lg:gap-6 xl:items-stretch">
              <div className="flex min-h-0 min-w-0 flex-col lg:col-span-7 max-xl:min-h-0">
                <ReportMesasSection />
              </div>

              <section className="reports-chart-reveal flex h-auto max-h-[min(24rem,60vh)] min-h-0 w-full flex-col self-start border-t border-zinc-200/70 pt-4 dark:border-zinc-800 lg:col-span-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0 xl:h-full xl:max-h-none xl:self-stretch">
                <Suspense fallback={<ReportActivityFeedSkeleton />}>
                  <ReportActivityFeed />
                </Suspense>
              </section>
            </div>
          </div>
        </div>
      </ReportsNavPendingProvider>
    </Suspense>
  );
}
