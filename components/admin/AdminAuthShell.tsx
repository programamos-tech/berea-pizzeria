import Image from "next/image";
import type { ReactNode } from "react";
import { AdminThemeToggle } from "@/components/admin/AdminThemeToggle";
import { LoginPhrases } from "@/components/admin/LoginPhrases";
import {
  adminProductBrand,
  adminSidebarLogoPath,
  liacoStackedLogoPath,
} from "@/lib/brand";

/** Chrome de autenticación (login en split) y picker de cuentas (canvas). */
export function AdminAuthShell({
  children,
  contentWidthClassName = "max-w-[420px]",
  layout = "split",
  headerActions,
}: {
  children: ReactNode;
  contentWidthClassName?: string;
  /** `split`: login (panel brand + form). `canvas`: cuentas (logo sobre blanco / dark). */
  layout?: "split" | "canvas";
  headerActions?: ReactNode;
}) {
  if (layout === "canvas") {
    return (
      <div className="relative min-h-dvh bg-white text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div
            className={`mx-auto flex w-full items-center justify-between gap-4 px-6 py-4 sm:px-8 ${contentWidthClassName}`}
          >
            <Image
              src={adminSidebarLogoPath}
              alt="Berea House"
              width={480}
              height={265}
              className="h-8 w-auto max-w-[10.5rem] object-contain object-left"
              priority
            />
            <div className="flex items-center gap-1 sm:gap-2">
              {headerActions}
              <AdminThemeToggle className="rounded-lg" />
            </div>
          </div>
        </header>
        <main className="px-6 py-8 sm:px-8 sm:py-10">
          <div className={`mx-auto w-full ${contentWidthClassName}`}>
            {children}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-white text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
      <div className="pointer-events-none absolute right-3 top-3 z-20 sm:right-5 sm:top-5">
        <div className="pointer-events-auto">
          <AdminThemeToggle className="rounded-lg" />
        </div>
      </div>

      <div className="relative z-10 flex min-h-dvh flex-col lg:flex-row">
        {/* Facturas pattern: solid coral + centered transparent mascot */}
        <aside className="flex shrink-0 flex-col items-center justify-center bg-[var(--admin-coral)] px-8 py-12 text-white lg:min-h-dvh lg:w-[46%] lg:flex-none">
          <Image
            src="/login-liaco-pizza.png"
            alt="Liaco pizza"
            width={855}
            height={855}
            className="h-auto w-full max-w-[16rem] object-contain sm:max-w-[20rem] lg:max-w-[22rem]"
            priority
          />
          <LoginPhrases />
        </aside>

        <main className="relative flex min-w-0 flex-1 flex-col justify-center px-6 py-12 sm:px-10 lg:px-16">
          <div className={`relative mx-auto w-full ${contentWidthClassName}`}>
            <div className="mb-8">
              <Image
                src={liacoStackedLogoPath}
                alt={adminProductBrand}
                width={273}
                height={165}
                className="h-14 w-auto object-contain object-left sm:h-16"
                priority
              />
            </div>
            {children}
            <p className="mt-10 flex flex-col items-center gap-1.5">
              <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-zinc-400">
                Powered by
              </span>
              <Image
                src={adminSidebarLogoPath}
                alt="Berea House"
                width={480}
                height={265}
                className="h-5 w-auto max-w-[7.5rem] object-contain"
              />
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
