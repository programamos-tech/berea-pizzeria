import Link from "next/link";
import { LogIn } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { OperatorAccountEditForm } from "@/components/admin/OperatorAccountEditForm";
import { OperatorAccountEnterButton } from "@/components/admin/OperatorAccountEnterButton";
import { OperatorAccountLogo } from "@/components/admin/OperatorAccountLogo";
import { OperatorAccountModulesPanel } from "@/components/admin/OperatorAccountModulesPanel";
import { parseDisabledAccountModules } from "@/lib/admin-account-modules";
import {
  collaboratorJobRoleLabel,
  normalizeCollaboratorJobRole,
} from "@/lib/admin-permissions";
import {
  adminPageSubtitleClass,
  adminPageTitleClass,
  adminPanelClass,
  adminTableWrapClass,
  adminToolbarBtnActiveClass,
  adminToolbarBtnBaseClass,
} from "@/lib/admin-ui";
import { loadAdminPermissions } from "@/lib/load-admin-permissions";
import { formatCop } from "@/lib/money";
import {
  tenantAccountStatusTone,
  tenantOperationalTone,
  toOperatorAccountRow,
} from "@/lib/operator-accounts";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { storeOrderStatusLabel } from "@/lib/store-order-status";
import { formatStoreDateTime } from "@/lib/store-datetime-format";
import { parseTenantBrand } from "@/lib/tenant-brand";
import { tenantProductHost } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

function formatDay(iso: string | null | undefined) {
  if (!iso) return "—";
  return formatStoreDateTime(iso, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Section({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`${adminPanelClass} scroll-mt-24 overflow-hidden`}>
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800 sm:px-5">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
        {hint ? (
          <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${adminPanelClass} px-4 py-3`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 truncate text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {value}
      </p>
    </div>
  );
}

const th =
  "px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500";
const td = "px-4 py-3 align-middle text-sm text-zinc-700 dark:text-zinc-300";

export default async function AdminCuentaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const perm = await loadAdminPermissions();
  if (!perm) redirect("/admin/login");
  if (!perm.isPlatformOperator) redirect("/admin");

  let service: ReturnType<typeof createSupabaseServiceClient>;
  try {
    service = createSupabaseServiceClient();
  } catch {
    redirect("/admin/cuentas");
  }

  const { data: tenant } = await service
    .from("tenants")
    .select(
      "id, slug, name, status, account_holder_name, account_holder_email, brand, custom_domains, created_at, disabled_modules",
    )
    .eq("id", id)
    .eq("kind", "customer")
    .maybeSingle();

  if (!tenant?.id) notFound();

  const tenantId = tenant.id as string;
  const [lastOrderRes, staffListRes, productsRes, customersRes, ordersRes] =
    await Promise.all([
      service
        .from("orders")
        .select("created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      service
        .from("profiles")
        .select(
          "id, display_name, login_username, public_email, job_role, is_active",
        )
        .eq("tenant_id", tenantId)
        .eq("is_platform_operator", false)
        .order("display_name", { ascending: true }),
      service
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
      service
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
      service
        .from("orders")
        .select("id, created_at, status, total_cents, customer_name, customer_email")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

  const row = toOperatorAccountRow({
    id: tenantId,
    slug: tenant.slug as string,
    name: tenant.name as string,
    status: tenant.status,
    account_holder_name: tenant.account_holder_name as string | null,
    account_holder_email: tenant.account_holder_email as string | null,
    brand: tenant.brand,
    lastSaleAt: (lastOrderRes.data?.created_at as string | undefined) ?? null,
  });
  const brand = parseTenantBrand(tenant.brand);
  const estado = tenantAccountStatusTone(row.status);
  const operativo = tenantOperationalTone({
    status: row.status,
    lastSaleAt: row.lastSaleAt,
  });
  const domains = Array.isArray(tenant.custom_domains)
    ? (tenant.custom_domains as string[]).filter(Boolean)
    : [];
  const staff = staffListRes.data ?? [];
  const orders = ordersRes.data ?? [];
  const ficha: Array<[string, string]> = [
    ["Titular", row.holderName],
    ["Correo", row.email || "—"],
    ["Teléfono", row.phone || "—"],
    ["WhatsApp", brand.whatsapp || "—"],
    ["Nombre comercial", row.tradeName],
    ["Razón social", brand.legal_name || "—"],
    ["NIT", brand.tax_nit || "—"],
    ["Régimen", brand.tax_regime || "—"],
    ["Ciudad", brand.city || "—"],
    ["Dirección", brand.address || "—"],
    ["Correo del negocio", brand.email || "—"],
    ["Alta", formatDay(tenant.created_at as string)],
    ["Slug", row.slug],
    ["Host", tenantProductHost(row.slug)],
    ["Dominios", domains.length > 0 ? domains.join(", ") : "—"],
  ];

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <header id="resumen" className="flex scroll-mt-24 flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <OperatorAccountLogo
            src={row.logoSrc}
            name={row.tradeName}
            size={64}
            plateColor={row.plateColor}
            fullColor={row.logoFullColor}
          />
          <div className="min-w-0">
            <h1 className={adminPageTitleClass}>{row.holderName}</h1>
            <p className="mt-1 truncate text-base font-medium text-zinc-900 dark:text-zinc-100">
              {row.tradeName}
            </p>
            <p className={adminPageSubtitleClass}>
              <span className={estado.className}>{estado.label}</span>
              <span className="mx-1.5 text-zinc-400">·</span>
              <span className={operativo.className}>{operativo.label}</span>
            </p>
          </div>
        </div>
        {row.canEnter ? (
          <OperatorAccountEnterButton
            row={row}
            className={`${adminToolbarBtnBaseClass} ${adminToolbarBtnActiveClass}`}
          >
            <LogIn className="size-4" strokeWidth={2} aria-hidden />
            Entrar a la cuenta
          </OperatorAccountEnterButton>
        ) : null}
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Productos" value={String(productsRes.count ?? 0)} />
        <Stat label="Clientes" value={String(customersRes.count ?? 0)} />
        <Stat label="Equipo" value={String(staff.length)} />
        <Stat label="Última venta" value={formatDay(row.lastSaleAt)} />
      </div>

      <Section
        id="modulos"
        title="Módulos"
        hint="Lo que apagues desaparece del menú y del panel de esta cuenta, para todo el equipo."
      >
        <OperatorAccountModulesPanel
          tenantId={row.id}
          disabledModules={parseDisabledAccountModules(tenant.disabled_modules)}
          errorBanner={
            sp.error === "modules"
              ? "No se pudo guardar los módulos. Probá de nuevo."
              : null
          }
        />
      </Section>

      <Section id="equipo" title="Equipo" hint="Usuarios que entran a esta tienda.">
        {staff.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-500">Sin usuarios.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60">
                <tr>
                  <th className={th}>Nombre</th>
                  <th className={th}>Usuario</th>
                  <th className={th}>Correo</th>
                  <th className={th}>Rol</th>
                  <th className={th}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((person) => {
                  const role = collaboratorJobRoleLabel(
                    normalizeCollaboratorJobRole(person.job_role as string | null),
                  );
                  const active = person.is_active !== false;
                  return (
                    <tr
                      key={person.id as string}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80"
                    >
                      <td className={`${td} font-medium text-zinc-900 dark:text-zinc-100`}>
                        {(person.display_name as string | null)?.trim() || "—"}
                      </td>
                      <td className={td}>
                        {(person.login_username as string | null)?.trim() || "—"}
                      </td>
                      <td className={td}>
                        {(person.public_email as string | null)?.trim() || "—"}
                      </td>
                      <td className={td}>{role}</td>
                      <td className={td}>
                        <span className={active ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-500"}>
                          {active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section id="ventas" title="Ventas recientes">
        {orders.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-500">Sin ventas.</p>
        ) : (
          <div className={`${adminTableWrapClass} rounded-none border-0 shadow-none`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left">
                <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <tr>
                    <th className={th}>Fecha</th>
                    <th className={th}>Cliente</th>
                    <th className={th}>Estado</th>
                    <th className={`${th} text-right`}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id as string}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80"
                    >
                      <td className={`${td} whitespace-nowrap`}>
                        {formatDay(order.created_at as string)}
                      </td>
                      <td className={td}>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                          {(order.customer_name as string | null)?.trim() || "—"}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {(order.customer_email as string | null)?.trim() || ""}
                        </p>
                      </td>
                      <td className={td}>
                        {storeOrderStatusLabel(String(order.status ?? ""))}
                      </td>
                      <td className={`${td} text-right font-medium text-zinc-900 dark:text-zinc-100`}>
                        {formatCop(Number(order.total_cents) || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>

      <Section id="ficha" title="Ficha de la cuenta">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <tbody>
              {ficha.map(([label, value]) => (
                <tr
                  key={label}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80"
                >
                  <th className="w-48 px-4 py-2.5 text-left text-xs font-medium text-zinc-500">
                    {label}
                  </th>
                  <td className="px-4 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800">
          <Link href="/admin/cuentas" className="font-medium underline-offset-4 hover:underline">
            Volver al listado
          </Link>
        </p>
      </Section>

      <Section
        id="editar"
        title="Editar información"
        hint="Cambia el titular, el correo de acceso del propietario y los datos del negocio."
      >
        <OperatorAccountEditForm
          saved={sp.saved === "1"}
          error={sp.error === "email" || sp.error === "info" ? sp.error : null}
          values={{
            tenantId: row.id,
            holderName: row.holderName === "Sin titular" ? "" : row.holderName,
            holderEmail: row.email ?? "",
            phone: row.phone ?? "",
            whatsapp: brand.whatsapp ?? "",
            tradeName: row.tradeName,
            legalName: brand.legal_name ?? "",
            taxNit: brand.tax_nit ?? "",
            taxRegime: brand.tax_regime ?? "",
            city: brand.city ?? "",
            address: brand.address ?? "",
            businessEmail: brand.email ?? "",
          }}
        />
      </Section>
    </div>
  );
}
