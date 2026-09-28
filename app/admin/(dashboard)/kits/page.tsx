import Link from "next/link";
import { RefreshCw } from "lucide-react";
import {
  KitsAdminTable,
  type KitsAdminTableRow,
} from "@/components/admin/KitsAdminTable";
import { InventorySubnav } from "@/components/admin/InventorySubnav";
import { storagePublicObjectUrl } from "@/lib/storage-public-url";
import { fetchKitsForAdminList } from "@/lib/load-product-kits";
import {
  kitIsAvailable,
  maxKitsAvailableFromItems,
  resolveKitSalePriceCents,
} from "@/lib/product-kits";
import { loadAdminPermissions } from "@/lib/load-admin-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  adminPageSubtitleClass,
  adminPageTitleClass,
  adminToolbarBtnActiveClass,
  adminToolbarBtnBaseClass,
  adminToolbarIconBtnClass,
} from "@/lib/admin-ui";

export const dynamic = "force-dynamic";

export default async function AdminKitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [perm, kits] = await Promise.all([
    loadAdminPermissions(),
    createSupabaseServerClient().then((supabase) =>
      fetchKitsForAdminList(supabase),
    ),
  ]);
  const canEdit = Boolean(perm?.permissions.kits_gestionar);
  const canSeeProducts = Boolean(perm?.permissions.inventario_ver);
  const sp = await searchParams;
  const created = sp.created === "1";

  const rows: KitsAdminTableRow[] = kits.map((kit) => {
    const items = kit.items ?? [];
    return {
      id: kit.id,
      name: kit.name,
      imageUrl: storagePublicObjectUrl(kit.image_path),
      itemsCount: items.length,
      priceCents: resolveKitSalePriceCents(kit, items, "pos"),
      maxPos: maxKitsAvailableFromItems(items, "pos"),
      maxStore: maxKitsAvailableFromItems(items, "storefront"),
      available: kitIsAvailable(kit, "pos"),
      published: Boolean(kit.is_published),
    };
  });

  return (
    <div className="flex w-full min-w-0 max-w-none flex-col gap-4">
      {created ? (
        <p className="rounded-lg border border-emerald-200/80 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-100">
          Kit creado correctamente.
        </p>
      ) : null}

      <header className="flex shrink-0 flex-wrap items-start justify-between gap-2 gap-y-3">
        <div className="min-w-0">
          <h1 className={adminPageTitleClass}>Inventario</h1>
          <p className={adminPageSubtitleClass}>
            Kits · combos del menú para tienda y mostrador
          </p>
        </div>
        <InventorySubnav
          active="kits"
          showProducts={canSeeProducts}
          showKits
          showIngredients={canSeeProducts}
          showRecipes={canSeeProducts}
          trailing={
            <>
              <Link
                href="/admin/kits"
                className={adminToolbarIconBtnClass}
                title="Recargar listado"
                aria-label="Actualizar"
              >
                <RefreshCw
                  className="size-4 shrink-0"
                  strokeWidth={2.25}
                  aria-hidden
                />
              </Link>
              {canEdit ? (
                <Link
                  href="/admin/kits/nuevo"
                  className={`${adminToolbarBtnBaseClass} ${adminToolbarBtnActiveClass}`}
                >
                  + Nuevo kit
                </Link>
              ) : null}
            </>
          }
        />
      </header>

      <section className="min-h-0 border-t border-zinc-200/70 pt-4 dark:border-zinc-800">
        {rows.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Todavía no hay kits.
            </p>
            {canEdit ? (
              <Link
                href="/admin/kits/nuevo"
                className="mt-3 inline-block text-sm font-medium text-zinc-800 underline underline-offset-2 dark:text-zinc-200"
              >
                Crear el primero
              </Link>
            ) : null}
          </div>
        ) : (
          <KitsAdminTable rows={rows} canEdit={canEdit} />
        )}
      </section>
    </div>
  );
}
