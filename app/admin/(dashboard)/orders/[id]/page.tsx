import { accountAllowsCredit } from "@/lib/admin-account-modules";
import { AdminOrderInvoiceScreen } from "@/components/admin/AdminOrderInvoiceScreen";
import { safeAdminVentasListReturnPath } from "@/lib/admin-ventas-list-url";
import { loadAdminPermissions } from "@/lib/load-admin-permissions";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminOrderDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const perm = await loadAdminPermissions();
  return (
    <AdminOrderInvoiceScreen
      orderId={id}
      searchParams={sp}
      listHref={safeAdminVentasListReturnPath(sp.returnTo)}
      listLabel="Pedidos"
      creditVariant="summary"
      canRegisterCredit={Boolean(perm?.permissions.creditos_abonar)}
      canUseCredit={accountAllowsCredit(perm?.permissions ?? {})}
    />
  );
}
