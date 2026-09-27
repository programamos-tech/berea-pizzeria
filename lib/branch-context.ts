export const ACTIVE_BRANCH_COOKIE = "berea_active_branch" as const;
export const ACTIVE_BRANCH_HEADER = "x-berea-branch-id" as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isBranchId(raw: string | null | undefined): raw is string {
  return Boolean(raw && UUID_RE.test(raw.trim()));
}

export const ACTIVE_BRANCH_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Cookie de sucursal activa escrita desde el navegador; RLS valida la membresía. */
export function writeActiveBranchCookie(branchId: string): void {
  document.cookie = [
    `${ACTIVE_BRANCH_COOKIE}=${branchId}`,
    "path=/",
    `max-age=${ACTIVE_BRANCH_COOKIE_MAX_AGE}`,
    "samesite=lax",
    window.location.protocol === "https:" ? "secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

const BRANCH_SCOPED_DETAIL_PATHS: { pattern: RegExp; fallback: (m: RegExpMatchArray) => string }[] = [
  { pattern: /^\/admin\/customers\/[^/]+/, fallback: () => "/admin/customers" },
  { pattern: /^\/admin\/orders\/[^/]+/, fallback: () => "/admin/orders" },
  { pattern: /^\/admin\/caja\/[^/]+/, fallback: () => "/admin/caja" },
  { pattern: /^\/admin\/creditos\/[^/]+/, fallback: () => "/admin/creditos" },
  { pattern: /^\/admin\/egresos\/[^/]+/, fallback: () => "/admin/egresos" },
  {
    pattern: /^(\/admin\/proveedores\/[^/]+)\/facturas\/[^/]+/,
    fallback: (m) => m[1]!,
  },
];

/**
 * Clientes, ventas, caja, créditos, egresos y facturas de proveedor son de una
 * sola sucursal: al cambiar de sucursal, su ficha no existe en la nueva.
 */
export function branchSafeAdminPath(pathname: string): string {
  if (/^\/admin\/(caja|egresos)\/(nueva|nuevo|conceptos|simular-manana)(\/|$)/.test(pathname)) {
    return pathname;
  }
  for (const { pattern, fallback } of BRANCH_SCOPED_DETAIL_PATHS) {
    const match = pathname.match(pattern);
    if (match) return fallback(match);
  }
  return pathname;
}

export type BranchRef = {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  logoPath: string | null;
  isDefault: boolean;
  isActive: boolean;
};

export type BranchContext = {
  active: BranchRef;
  available: BranchRef[];
};
