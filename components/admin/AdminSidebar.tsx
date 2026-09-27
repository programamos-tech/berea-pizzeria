"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Suspense, type SVGProps } from "react";
import {
  adminNavItemActive,
  filterAdminNavSections,
} from "@/components/admin/admin-nav-config";
import { BranchSwitcher } from "@/components/admin/BranchSwitcher";
import { OperatorAccountLogo } from "@/components/admin/OperatorAccountLogo";
import {
  adminProductBrand,
  adminSidebarLogoPath,
  adminSupportWhatsAppDisplay,
  adminSupportWhatsAppPrefilledText,
  adminSupportWhatsAppUrl,
} from "@/lib/brand";
import type { BranchContext } from "@/lib/branch-context";
import { storagePublicObjectUrl } from "@/lib/storage-public-url";

function Icon(props: SVGProps<SVGSVGElement> & { children: React.ReactNode }) {
  const { children, className = "", ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`size-[18px] shrink-0 ${className}`}
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

const STOREFRONT_HREF = "/";

function IconExternalStore({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </Icon>
  );
}

const sidebarInkMuted = "text-zinc-500 dark:text-zinc-500";
const sidebarBorder = "border-zinc-200 dark:border-zinc-800/90";

type AccountBrand = {
  name: string;
  logoSrc: string;
  plateColor: string;
  logoFullColor?: boolean;
};

function SidebarProductBrand({ account }: { account: AccountBrand }) {
  return (
    <Link
      href="/admin"
      prefetch
      className="inline-flex rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-zinc-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-sidebar-bg)]"
    >
      {account.logoFullColor ? (
        <span
          className="relative block h-14 w-28 overflow-hidden rounded-xl"
          style={{ backgroundColor: account.plateColor }}
        >
          <Image
            src={account.logoSrc}
            alt={account.name}
            fill
            sizes="76px"
            unoptimized
            className="object-contain p-1.5"
          />
        </span>
      ) : (
        <OperatorAccountLogo
          src={account.logoSrc}
          name={account.name}
          size={56}
          plateColor={account.plateColor}
          fullColor={account.logoFullColor}
        />
      )}
    </Link>
  );
}

function SidebarTenantAccount({
  account,
  branchContext,
  showStorefront,
  onNavigate,
}: {
  account: AccountBrand;
  branchContext: BranchContext;
  showStorefront: boolean;
  onNavigate: () => void;
}) {
  const branchLogo = storagePublicObjectUrl(branchContext.active.logoPath);
  const markSrc = branchLogo ?? account.logoSrc;
  const cardClass =
    "mt-3.5 flex w-full items-center gap-2.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-left dark:border-zinc-700/70 dark:bg-zinc-900/55";

  return (
    <div className={cardClass}>
      <OperatorAccountLogo
        src={markSrc}
        name={branchContext.active.name}
        size={32}
        plateColor={branchLogo ? "#ffffff" : account.plateColor}
        fullColor={Boolean(branchLogo) || account.logoFullColor}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
          Sucursal activa
        </span>
        <BranchSwitcher
          active={branchContext.active}
          branches={branchContext.available}
          appearance="bare"
          className="mt-0.5 w-full"
        />
      </span>
      {showStorefront ? (
        <Link
          href={STOREFRONT_HREF}
          prefetch
          onClick={() => onNavigate()}
          title={`Ver tienda · ${account.name}`}
          className={`shrink-0 rounded-md p-1 opacity-70 transition hover:bg-zinc-100 hover:opacity-100 dark:hover:bg-zinc-800 ${sidebarInkMuted}`}
        >
          <IconExternalStore className="size-4" />
          <span className="sr-only">Ver tienda</span>
        </Link>
      ) : null}
    </div>
  );
}

function SidebarHeader({
  account,
  branchContext,
  showStorefront,
  onNavigate,
}: {
  account: AccountBrand;
  branchContext: BranchContext;
  showStorefront: boolean;
  onNavigate: () => void;
}) {
  return (
    <div className={`border-b px-3 py-3 ${sidebarBorder}`}>
      <div className="flex flex-col items-center text-center">
        <SidebarProductBrand account={account} />
        <p
          className={`mt-2 text-[13px] font-semibold tracking-tight text-zinc-800 dark:text-zinc-200`}
        >
          {account.name}
        </p>
        <p
          className={`mt-0.5 whitespace-nowrap text-[10px] font-medium tracking-wide ${sidebarInkMuted}`}
        >
          Gestiona tu Pizzería
        </p>
      </div>
      <SidebarTenantAccount
        account={account}
        branchContext={branchContext}
        showStorefront={showStorefront}
        onNavigate={onNavigate}
      />
    </div>
  );
}

function IconWhatsApp({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

function SidebarPoweredBy() {
  return (
    <p className="mt-3 flex flex-col items-center gap-1 px-1">
      <span className={`text-[9px] font-medium uppercase tracking-[0.14em] ${sidebarInkMuted}`}>
        Powered by
      </span>
      <Image
        src={adminSidebarLogoPath}
        alt={adminProductBrand}
        width={480}
        height={265}
        className="h-5 w-auto max-w-[7.5rem] object-contain object-center"
      />
    </p>
  );
}

function SidebarSupportCard() {
  const href = `${adminSupportWhatsAppUrl}?text=${encodeURIComponent(adminSupportWhatsAppPrefilledText)}`;

  return (
    <div className={`mt-auto shrink-0 border-t px-2.5 py-3 ${sidebarBorder}`}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-none dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm">
          <IconWhatsApp className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-zinc-900 dark:text-white">
            ¿Necesitas ayuda?
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-zinc-500 dark:text-zinc-400">
            WhatsApp · {adminSupportWhatsAppDisplay}
          </span>
        </span>
        <span
          className="shrink-0 text-zinc-400 transition group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300"
          aria-hidden
        >
          →
        </span>
      </a>
      <SidebarPoweredBy />
    </div>
  );
}

function AdminSidebarInner({
  allowedNavHrefs,
  account,
  branchContext,
}: {
  allowedNavHrefs: string[];
  account: AccountBrand;
  branchContext: BranchContext;
}) {
  const pathname = usePathname();
  const allowed = new Set(allowedNavHrefs);
  const navSectionsFiltered = filterAdminNavSections(allowedNavHrefs);

  const linkClass = (active: boolean) =>
    [
      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition",
      active
        ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900 dark:shadow-none"
        : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100",
    ].join(" ");

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-[50] hidden w-64 shrink-0 flex-col border-r bg-[var(--admin-sidebar-bg)] print:hidden lg:flex ${sidebarBorder}`}
    >
      <SidebarHeader
        account={account}
        branchContext={branchContext}
        showStorefront={allowed.has(STOREFRONT_HREF)}
        onNavigate={() => {}}
      />
      <nav
        id="admin-sidebar-nav"
        className="admin-sidebar-nav-scroll flex-1 space-y-6 overflow-y-auto overscroll-contain px-2.5 py-4"
      >
        {navSectionsFiltered.map((section) => (
          <div key={section.title}>
            <p
              className={`px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${sidebarInkMuted}`}
            >
              {section.title}
            </p>
            <ul className="mt-2 space-y-0.5">
              {section.items.map((item) => {
                const active = adminNavItemActive(pathname, item.href, item);
                const children = item.children ?? [];
                return (
                  <li key={`${section.title}-${item.label}`}>
                    <Link
                      href={item.href}
                      prefetch
                      className={linkClass(
                        children.length > 0
                          ? false
                          : active,
                      )}
                    >
                      {item.icon}
                      <span
                        className={
                          children.length > 0 && active
                            ? "font-semibold text-zinc-900 dark:text-zinc-100"
                            : undefined
                        }
                      >
                        {item.label}
                      </span>
                    </Link>
                    {children.length > 0 ? (
                      <ul className="mt-0.5 space-y-0.5 border-l border-zinc-200 py-0.5 pl-2 ml-[1.15rem] dark:border-zinc-800">
                        {children.map((child) => {
                          const childActive = adminNavItemActive(
                            pathname,
                            child.href,
                          );
                          return (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                prefetch
                                className={[
                                  "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition",
                                  childActive
                                    ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900 dark:shadow-none"
                                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100",
                                ].join(" ")}
                              >
                                {child.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <SidebarSupportCard />
    </aside>
  );
}

function AdminSidebarFallback({
  account,
}: {
  account: AccountBrand;
}) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-[45] hidden w-64 flex-col border-r bg-[var(--admin-sidebar-bg)] print:hidden lg:flex lg:flex-col ${sidebarBorder}`}
    >
      <div className={`border-b px-3 py-3 ${sidebarBorder}`}>
        <div className="flex flex-col items-center text-center">
          <SidebarProductBrand account={account} />
          <p
            className={`mt-2 text-[13px] font-semibold tracking-tight text-zinc-800 dark:text-zinc-200`}
          >
            {account.name}
          </p>
          <p
            className={`mt-0.5 whitespace-nowrap text-[10px] font-medium tracking-wide ${sidebarInkMuted}`}
          >
            Gestiona tu Pizzería
          </p>
        </div>
        <div className="mt-3.5 flex w-full items-center gap-2.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 dark:border-zinc-700/70 dark:bg-zinc-900/55">
          <span className="size-8 shrink-0 overflow-hidden rounded-md bg-zinc-200 dark:bg-zinc-700" />
          <span className="min-w-0 flex-1">
            <span className="block h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-700" />
          </span>
        </div>
      </div>
      <div className="flex-1 px-2.5 py-4" aria-busy aria-label="Cargando menú" />
    </aside>
  );
}

export function AdminSidebar({
  allowedNavHrefs,
  account,
  branchContext,
}: {
  allowedNavHrefs: string[];
  account: AccountBrand;
  branchContext: BranchContext;
}) {
  return (
    <Suspense fallback={<AdminSidebarFallback account={account} />}>
      <AdminSidebarInner
        allowedNavHrefs={allowedNavHrefs}
        account={account}
        branchContext={branchContext}
      />
    </Suspense>
  );
}
