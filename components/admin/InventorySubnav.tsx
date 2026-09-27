import Link from "next/link";
import {
  adminToolbarBtnActiveClass,
  adminToolbarBtnBaseClass,
  adminToolbarBtnIdleClass,
} from "@/lib/admin-ui";

type InventorySubnavProps = {
  active: "products" | "kits" | "ingredients" | "recipes";
  showProducts?: boolean;
  showKits?: boolean;
  showIngredients?: boolean;
  showRecipes?: boolean;
};

export function InventorySubnav({
  active,
  showProducts = true,
  showKits = true,
  showIngredients = false,
  showRecipes = false,
}: InventorySubnavProps) {
  const tabs: { key: InventorySubnavProps["active"]; href: string; label: string; show: boolean }[] =
    [
      { key: "products", href: "/admin/products", label: "Productos", show: showProducts },
      { key: "kits", href: "/admin/kits", label: "Kits", show: showKits },
      {
        key: "ingredients",
        href: "/admin/ingredients",
        label: "Insumos",
        show: showIngredients,
      },
      { key: "recipes", href: "/admin/recipes", label: "Recetas", show: showRecipes },
    ];
  const visible = tabs.filter((t) => t.show);
  if (visible.length <= 1 && visible[0]?.key === active) return null;
  if (visible.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="tablist"
      aria-label="Sección de inventario"
    >
      {visible.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          role="tab"
          aria-selected={active === tab.key}
          className={`${adminToolbarBtnBaseClass} ${
            active === tab.key
              ? adminToolbarBtnActiveClass
              : adminToolbarBtnIdleClass
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
