import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen, CookingPot, Package, Layers } from "lucide-react";
import {
  adminToolbarBtnActiveClass,
  adminToolbarBtnBaseClass,
  adminToolbarBtnIdleClass,
} from "@/lib/admin-ui";

export type InventorySection = "products" | "kits" | "ingredients" | "recipes";

type InventorySubnavProps = {
  active: InventorySection;
  showProducts?: boolean;
  showKits?: boolean;
  showIngredients?: boolean;
  showRecipes?: boolean;
  /** Extra actions after the section switcher (refresh, nuevo, etc.). */
  trailing?: ReactNode;
};

const OPTIONS: Array<{
  key: InventorySection;
  href: string;
  label: string;
  hint: string;
  Icon: typeof Package;
}> = [
  {
    key: "products",
    href: "/admin/products",
    label: "Menú",
    hint: "Lo que vendes",
    Icon: CookingPot,
  },
  {
    key: "ingredients",
    href: "/admin/ingredients",
    label: "Insumos",
    hint: "Lo que compras",
    Icon: Package,
  },
  {
    key: "recipes",
    href: "/admin/recipes",
    label: "Recetas",
    hint: "Cómo se arma",
    Icon: BookOpen,
  },
  {
    key: "kits",
    href: "/admin/kits",
    label: "Kits",
    hint: "Combos del menú",
    Icon: Layers,
  },
];

/**
 * Switcher de sección Inventario — mismo patrón que Reportes (icono + label
 * a la derecha del H1), no tabs debajo del título.
 */
export function InventorySubnav({
  active,
  showProducts = true,
  showKits = true,
  showIngredients = false,
  showRecipes = false,
  trailing,
}: InventorySubnavProps) {
  const visibility: Record<InventorySection, boolean> = {
    products: showProducts,
    kits: showKits,
    ingredients: showIngredients,
    recipes: showRecipes,
  };
  const visible = OPTIONS.filter((o) => visibility[o.key]);
  if (visible.length === 0 && !trailing) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {visible.length > 0 ? (
        <div
          className="inline-flex shrink-0 flex-nowrap items-center gap-2"
          role="group"
          aria-label="Sección de inventario"
        >
          {visible.map((opt) => {
            const Icon = opt.Icon;
            const isActive = active === opt.key;
            return (
              <Link
                key={opt.key}
                href={opt.href}
                aria-current={isActive ? "page" : undefined}
                title={opt.hint}
                className={`${adminToolbarBtnBaseClass} shrink-0 px-2.5 sm:px-3 ${
                  isActive ? adminToolbarBtnActiveClass : adminToolbarBtnIdleClass
                }`}
              >
                <Icon className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
                <span>{opt.label}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
      {trailing}
    </div>
  );
}
