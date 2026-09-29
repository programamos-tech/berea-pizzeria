import Link from "next/link";
import { AdminGlobalSearch } from "@/components/admin/AdminGlobalSearch";
import { AdminNotificationBell } from "@/components/admin/AdminNotificationBell";
import { AdminThemeToggle } from "@/components/admin/AdminThemeToggle";
import { AdminUserAvatar } from "@/components/admin/AdminUserAvatar";
import { AdminUserMenu } from "@/components/admin/AdminUserMenu";
import { LeaveAccountButton } from "@/components/admin/LeaveAccountButton";
import { OperatorAccountLogo } from "@/components/admin/OperatorAccountLogo";

type AdminTopBarProps = {
  showOrderNotifications?: boolean;
  displayName: string;
  email: string;
  isPlatformOperator?: boolean;
  actingAccount?: {
    holderName: string;
    storeName: string;
  } | null;
  accountBrand: {
    name: string;
    logoSrc: string;
    plateColor: string;
    logoFullColor?: boolean;
  };
};

export function AdminTopBar({
  showOrderNotifications = false,
  displayName,
  email,
  isPlatformOperator = false,
  actingAccount = null,
  accountBrand,
}: AdminTopBarProps) {
  return (
    <header className="sticky top-0 z-50 w-full min-w-0 max-w-full overflow-visible border-b border-zinc-200 bg-white/90 backdrop-blur-md print:hidden dark:border-zinc-800 dark:bg-zinc-900/90">
      {actingAccount ? (
        <div className="flex min-h-9 items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-1.5 text-[12px] text-zinc-100 sm:px-6">
          <p className="min-w-0 truncate">
            <span className="font-semibold">Cuenta de {actingAccount.holderName}</span>
            <span className="text-zinc-400"> · {actingAccount.storeName}</span>
          </p>
          <LeaveAccountButton className="shrink-0 rounded-md px-2 py-0.5 font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white disabled:opacity-60">
            Cambiar
          </LeaveAccountButton>
        </div>
      ) : null}
      <div className="flex h-14 min-w-0 max-w-full items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6">
        <Link
          href="/admin"
          prefetch
          className="flex shrink-0 items-center rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-zinc-400/50 lg:hidden"
          title={accountBrand.name}
        >
          <OperatorAccountLogo
            src={accountBrand.logoSrc}
            name={accountBrand.name}
            size={40}
            plateColor={accountBrand.plateColor}
            fullColor={accountBrand.logoFullColor}
          />
        </Link>

        <div className="flex min-w-0 flex-1 basis-0 items-center">
          <div className="w-full min-w-0 pl-0.5">
            <AdminGlobalSearch />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <div className="lg:hidden">
            <AdminThemeToggle />
          </div>
          <Link
            href="/admin/ventas/nueva"
            className="flex size-9 items-center justify-center rounded-full border border-[var(--admin-coral)] bg-[var(--admin-coral)] text-lg font-light leading-none text-white shadow-[0_8px_24px_-12px_color-mix(in_srgb,var(--admin-coral-deep)_40%,transparent)] transition hover:border-[var(--admin-coral-hover)] hover:bg-[var(--admin-coral-hover)] sm:size-10"
            title="Nueva factura"
          >
            +
          </Link>
          {showOrderNotifications ? <AdminNotificationBell /> : null}
          <div className="ml-0.5 hidden items-center gap-1 border-l border-zinc-200 pl-2 dark:border-zinc-700 lg:flex">
            <AdminThemeToggle />
          </div>

          <AdminUserMenu
            displayName={displayName}
            email={email}
            isPlatformOperator={isPlatformOperator}
            avatar={
              <AdminUserAvatar
                displayName={displayName}
                seed={email || displayName}
                size={40}
              />
            }
          />
        </div>
      </div>
    </header>
  );
}
