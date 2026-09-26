"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutGrid, Pencil, Receipt, ToggleRight, Users } from "lucide-react";
import { AdminThemeToggle } from "@/components/admin/AdminThemeToggle";
import { AdminUserAvatar } from "@/components/admin/AdminUserAvatar";
import { AdminUserMenu } from "@/components/admin/AdminUserMenu";
import { adminProductBrand, adminSidebarLogoPath } from "@/lib/brand";

const ACCOUNT_SECTIONS = [
  { href: "#resumen", label: "Resumen", icon: LayoutGrid },
  { href: "#modulos", label: "Módulos", icon: ToggleRight },
  { href: "#equipo", label: "Equipo", icon: Users },
  { href: "#ventas", label: "Ventas", icon: Receipt },
  { href: "#ficha", label: "Ficha", icon: Building2 },
  { href: "#editar", label: "Editar", icon: Pencil },
] as const;

function navClass(active: boolean) {
  return [
    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition",
    active
      ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
      : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100",
  ].join(" ");
}

export function OperatorBackofficeShell({
  displayName,
  email,
  children,
}: {
  displayName: string;
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/admin/cuentas";
  const onList = pathname === "/admin/cuentas";
  const onAccount = /^\/admin\/cuentas\/[^/]+$/.test(pathname);

  return (
    <div className="isolate flex min-h-dvh max-w-full items-stretch antialiased">
      <aside className="fixed inset-y-0 left-0 z-[50] hidden w-64 shrink-0 flex-col border-r border-zinc-200 bg-[var(--admin-sidebar-bg)] lg:flex dark:border-zinc-800/90">
        <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800/90">
          <Link href="/admin/cuentas" className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50">
            <Image
              src={adminSidebarLogoPath}
              alt={adminProductBrand}
              width={480}
              height={265}
              className="h-7 w-auto max-w-[9.5rem] object-contain object-left"
              priority
            />
          </Link>
          <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            Backoffice
          </p>
        </div>
        <nav className="admin-sidebar-nav-scroll flex-1 space-y-6 overflow-y-auto px-2.5 py-4">
          <div>
            <p className="px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Plataforma
            </p>
            <ul className="mt-2">
              <li>
                <Link href="/admin/cuentas" className={navClass(onList)}>
                  <LayoutGrid className="size-[18px] shrink-0" strokeWidth={1.65} aria-hidden />
                  Cuentas
                </Link>
              </li>
            </ul>
          </div>
          {onAccount ? (
            <div>
              <p className="px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Esta cuenta
              </p>
              <ul className="mt-2 space-y-0.5">
                {ACCOUNT_SECTIONS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <a href={item.href} className={navClass(false)}>
                        <Icon className="size-[18px] shrink-0" strokeWidth={1.65} aria-hidden />
                        {item.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </nav>
      </aside>

      <div className="relative z-10 flex min-h-dvh min-w-0 max-w-full flex-1 flex-col bg-white dark:bg-zinc-950 lg:ml-64">
        <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/90">
          <div className="flex h-14 items-center gap-3 px-3 sm:h-16 sm:px-6">
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-500">
              <Link href="/admin/cuentas" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                Cuentas
              </Link>
              {onAccount ? (
                <span className="text-zinc-400"> · Detalle</span>
              ) : null}
            </p>
            <AdminThemeToggle />
            <AdminUserMenu
              displayName={displayName}
              email={email}
              isPlatformOperator
              avatar={
                <AdminUserAvatar
                  displayName={displayName}
                  seed={email || displayName}
                  size={40}
                />
              }
            />
          </div>
          {onAccount ? (
            <nav className="flex gap-1 overflow-x-auto border-t border-zinc-100 px-3 py-2 lg:hidden dark:border-zinc-800">
              {ACCOUNT_SECTIONS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          ) : null}
        </header>
        <main className="min-w-0 flex-1 p-3 sm:p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
