import type { ReactNode, SVGProps } from "react";

function Icon(props: SVGProps<SVGSVGElement> & { children: ReactNode }) {
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

export type AdminNavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  /** Submenú (p. ej. Menú / Kits bajo Inventario). */
  children?: AdminNavItem[];
};

export type AdminNavSection = {
  title: string;
  items: AdminNavItem[];
};

/**
 * Menú admin visible. Rutas en mantenimiento (banners, cupones, envíos, ajustes)
 * no se listan hasta reactivarlas.
 * Para apagar un módulo por cuenta (Cuentas), ver lib/admin-account-modules.ts.
 */
export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    title: "Comercial",
    items: [
      {
        href: "/admin",
        label: "Reportes",
        icon: (
          <Icon>
            <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z" />
          </Icon>
        ),
      },
      {
        href: "/admin/caja",
        label: "Caja",
        icon: (
          <Icon>
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <circle cx="12" cy="12" r="3" />
            <path d="M6 12h.01M18 12h.01" />
          </Icon>
        ),
      },
      {
        href: "/admin/ventas",
        label: "Ventas",
        icon: (
          <Icon>
            <path d="M6 3h12v18l-2-1-2 1-2-1-2 1-2-1-2 1V3Z" />
            <path d="M9 8h6M9 12h6M9 16h4" />
          </Icon>
        ),
      },
      {
        href: "/admin/creditos",
        label: "Créditos",
        icon: (
          <Icon>
            <path d="M6 4h12v16H6z" />
            <path d="M9 8h6M9 12h6M9 16h4" />
          </Icon>
        ),
      },
      {
        href: "/admin/egresos",
        label: "Gastos",
        icon: (
          <Icon>
            <path d="M4 6h16v12H4z" />
            <path d="M8 10h8" />
            <path d="M8 14h5" />
          </Icon>
        ),
      },
      {
        href: "/admin/products",
        label: "Inventario",
        icon: (
          <Icon>
            <path d="M21 16V8l-9-5-9 5v8l9 5 9-5z" />
            <path d="M3.3 7 12 12l8.7-5" />
          </Icon>
        ),
        children: [
          {
            href: "/admin/products",
            label: "Menú",
            icon: (
              <Icon>
                <path d="M21 16V8l-9-5-9 5v8l9 5 9-5z" />
                <path d="M3.3 7 12 12l8.7-5" />
              </Icon>
            ),
          },
          {
            href: "/admin/kits",
            label: "Kits",
            icon: (
              <Icon>
                <path d="M16.5 9.4 12 12 7.5 9.4" />
                <path d="M21 16V8l-9-5-9 5v8l9 5 9-5z" />
                <path d="M12 12v9" />
              </Icon>
            ),
          },
          {
            href: "/admin/ingredients",
            label: "Insumos",
            icon: (
              <Icon>
                <path d="M12 3v18" />
                <path d="M5 8h14" />
                <path d="M7 12h10" />
                <path d="M9 16h6" />
              </Icon>
            ),
          },
          {
            href: "/admin/recipes",
            label: "Recetas",
            icon: (
              <Icon>
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </Icon>
            ),
          },
        ],
      },
      {
        href: "/admin/customers",
        label: "Clientes",
        icon: (
          <Icon>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </Icon>
        ),
      },
    ],
  },
  {
    title: "Configuración",
    items: [
      {
        href: "/admin/configuracion",
        label: "Configuración",
        icon: (
          <Icon>
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.2.64.8 1.1 1.51 1.1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </Icon>
        ),
      },
      {
        href: "/admin/cuenta",
        label: "Mi cuenta",
        icon: (
          <Icon>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v1" />
          </Icon>
        ),
      },
      {
        href: "/admin/usuarios",
        label: "Equipo",
        icon: (
          <Icon>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </Icon>
        ),
      },
      {
        href: "/admin/sucursales",
        label: "Sucursales",
        icon: (
          <Icon>
            <path d="M4 21V7l8-4 8 4v14" />
            <path d="M8 21v-5h8v5M8 9h.01M12 9h.01M16 9h.01M8 12h.01M12 12h.01M16 12h.01" />
          </Icon>
        ),
      },
      {
        href: "/admin/actividades",
        label: "Registros",
        icon: (
          <Icon>
            <path d="M4 11h16" />
            <path d="M4 7h10" />
            <path d="M4 15h8" />
            <path d="M18 15h2" />
            <path d="M18 11h2" />
            <circle cx="18" cy="7" r="2" />
          </Icon>
        ),
      },
    ],
  },
];

const PRODUCTS_HREF = "/admin/products";
const KITS_HREF = "/admin/kits";
const INGREDIENTS_HREF = "/admin/ingredients";
const RECIPES_HREF = "/admin/recipes";
const VENTAS_HREF = "/admin/ventas";
const CREDITOS_HREF = "/admin/creditos";
const ORDERS_HREF = "/admin/orders";
const CUSTOMERS_HREF = "/admin/customers";
const USUARIOS_HREF = "/admin/usuarios";
const CUENTA_HREF = "/admin/cuenta";
const CONFIGURACION_HREF = "/admin/configuracion";

function pathMatches(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  const pathOnly = href.split("?")[0] ?? href;
  return pathname === pathOnly || pathname.startsWith(`${pathOnly}/`);
}

export function adminNavItemActive(
  pathname: string,
  href: string,
  item?: AdminNavItem,
): boolean {
  if (item?.children?.length) {
    return item.children.some((child) =>
      adminNavItemActive(pathname, child.href),
    );
  }
  if (href === CONFIGURACION_HREF) {
    return (
      pathname === CONFIGURACION_HREF ||
      pathname.startsWith(`${CONFIGURACION_HREF}/`)
    );
  }
  if (href === CUENTA_HREF) {
    return pathname === CUENTA_HREF || pathname.startsWith(`${CUENTA_HREF}/`);
  }
  if (href === USUARIOS_HREF) {
    return pathname === USUARIOS_HREF || pathname.startsWith(`${USUARIOS_HREF}/`);
  }
  if (href === CREDITOS_HREF) {
    return (
      pathname === CREDITOS_HREF || pathname.startsWith(`${CREDITOS_HREF}/`)
    );
  }
  if (href === VENTAS_HREF) {
    return (
      pathname === VENTAS_HREF ||
      pathname.startsWith(`${VENTAS_HREF}/`) ||
      pathname === ORDERS_HREF ||
      pathname.startsWith(`${ORDERS_HREF}/`)
    );
  }
  if (href === PRODUCTS_HREF) {
    return pathname === PRODUCTS_HREF || pathname.startsWith(`${PRODUCTS_HREF}/`);
  }
  if (href === KITS_HREF) {
    return pathname === KITS_HREF || pathname.startsWith(`${KITS_HREF}/`);
  }
  if (href === INGREDIENTS_HREF) {
    return (
      pathname === INGREDIENTS_HREF ||
      pathname.startsWith(`${INGREDIENTS_HREF}/`)
    );
  }
  if (href === RECIPES_HREF) {
    return pathname === RECIPES_HREF || pathname.startsWith(`${RECIPES_HREF}/`);
  }
  if (href === CUSTOMERS_HREF) {
    return (
      pathname === CUSTOMERS_HREF || pathname.startsWith(`${CUSTOMERS_HREF}/`)
    );
  }
  return pathMatches(pathname, href);
}

function filterNavItem(
  item: AdminNavItem,
  allowed: Set<string>,
): AdminNavItem | null {
  if (item.children?.length) {
    const children = item.children.filter((child) => allowed.has(child.href));
    if (children.length === 0) return null;
    return {
      ...item,
      href: children[0]!.href,
      children,
    };
  }
  if (!allowed.has(item.href)) return null;
  return item;
}

export function filterAdminNavSections(
  allowedNavHrefs: string[],
): AdminNavSection[] {
  const allowed = new Set(allowedNavHrefs);
  return ADMIN_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items
      .map((item) => filterNavItem(item, allowed))
      .filter((item): item is AdminNavItem => item != null),
  })).filter((section) => section.items.length > 0);
}

/** Items de primer nivel para la barra inferior (los hijos no se duplican como tabs). */
export function flattenAdminNavItems(
  sections: AdminNavSection[],
): AdminNavItem[] {
  return sections.flatMap((section) => section.items);
}

export function isInventorySectionPath(pathname: string): boolean {
  return (
    pathname === PRODUCTS_HREF ||
    pathname.startsWith(`${PRODUCTS_HREF}/`) ||
    pathname === KITS_HREF ||
    pathname.startsWith(`${KITS_HREF}/`)
  );
}
