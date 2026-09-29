/** Claves de permisos del panel (persistidas en `profiles.permissions`). */
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** Rol laboral del colaborador (columna `profiles.job_role`). */
export const COLLABORATOR_JOB_ROLES = [
  "owner",
  "admin",
  "sales",
  "inventory",
  "kitchen",
  "service",
] as const;

export type CollaboratorJobRole = (typeof COLLABORATOR_JOB_ROLES)[number];

export function isCollaboratorJobRole(
  raw: string | null | undefined,
): raw is CollaboratorJobRole {
  return (
    raw === "owner" ||
    raw === "admin" ||
    raw === "sales" ||
    raw === "inventory" ||
    raw === "kitchen" ||
    raw === "service"
  );
}

export function normalizeCollaboratorJobRole(
  raw: string | null | undefined,
): CollaboratorJobRole {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (v === "owner" || v === "propietario") return "owner";
  if (v === "admin" || v === "administrador") return "admin";
  if (v === "inventory" || v === "inventario" || v === "support") {
    return "inventory";
  }
  if (
    v === "kitchen" ||
    v === "cocinero" ||
    v === "cocina" ||
    v === "cook"
  ) {
    return "kitchen";
  }
  if (
    v === "service" ||
    v === "mesero" ||
    v === "mesera" ||
    v === "servicio" ||
    v === "waiter"
  ) {
    return "service";
  }
  if (v === "sales" || v === "venta" || v === "cashier" || v === "cajero") {
    return "sales";
  }
  return "sales";
}

export function collaboratorJobRoleLabel(role: CollaboratorJobRole): string {
  if (role === "owner") return "Propietario";
  if (role === "admin") return "Administrador";
  if (role === "inventory") return "Inventario";
  if (role === "kitchen") return "Cocinero";
  if (role === "service") return "Mesero";
  return "Venta";
}

export function collaboratorJobRoleToneClass(role: CollaboratorJobRole): string {
  if (role === "owner") {
    return "font-medium text-emerald-700 dark:text-emerald-300";
  }
  if (role === "admin") {
    return "font-medium text-amber-700 dark:text-amber-300";
  }
  if (role === "inventory") {
    return "font-medium text-violet-700 dark:text-violet-300";
  }
  if (role === "kitchen") {
    return "font-medium text-orange-700 dark:text-orange-300";
  }
  if (role === "service") {
    return "font-medium text-teal-700 dark:text-teal-300";
  }
  return "font-medium text-sky-700 dark:text-sky-300";
}

/** Propietario y administrador no quedan bloqueados por el candado de caja. */
export function jobRoleSkipsCashRegister(role: CollaboratorJobRole): boolean {
  return role === "owner" || role === "admin";
}

export const PERMISSION_KEYS = [
  "inicio_reportes",
  "reportes_tienda",
  "ventas_ver",
  "ventas_crear",
  "creditos_ver",
  "creditos_abonar",
  "clientes_ver",
  "clientes_crear",
  "clientes_editar",
  "egresos_ver",
  "egresos_crear",
  "proveedores_ver",
  "inventario_ver",
  "productos_crear",
  "productos_editar",
  "categorias_gestionar",
  "stock_actualizar",
  "stock_transferir",
  "caja_ver",
  "caja_gestionar",
  "roles_ver",
  "colaboradores_gestionar",
  "sucursales_ver",
  "sucursales_gestionar",
  "actividades_ver",
  "marketing_ver",
  "ajustes_tienda_ver",
  "kits_ver",
  "kits_gestionar",
] as const;

export type PermissionMap = Partial<Record<PermissionKey, boolean>>;

export type PermissionItem = {
  key: PermissionKey;
  label: string;
  /** Solo informativo en UI (ej. siempre visible para auditoría). */
  readOnly?: boolean;
};

export type PermissionModule = {
  id: string;
  label: string;
  items: PermissionItem[];
};

/**
 * Grupos de checkboxes en Equipo. Para apagar un módulo entero por cuenta
 * (Cuentas → ficha), ver `ACCOUNT_MODULES` en `lib/admin-account-modules.ts`.
 */
export const PERMISSION_MODULES: PermissionModule[] = [
  {
    id: "inicio",
    label: "Inicio",
    items: [
      { key: "inicio_reportes", label: "Reportes por periodo" },
      { key: "reportes_tienda", label: "Cómo va la tienda" },
    ],
  },
  {
    id: "ventas",
    label: "Ventas",
    items: [
      { key: "ventas_ver", label: "Ventas" },
      { key: "ventas_crear", label: "Crear ventas" },
      { key: "creditos_ver", label: "Ver créditos" },
      { key: "creditos_abonar", label: "Registrar y anular abonos" },
    ],
  },
  {
    id: "clientes",
    label: "Clientes",
    items: [
      { key: "clientes_ver", label: "Ver clientes" },
      { key: "clientes_crear", label: "Crear clientes" },
      { key: "clientes_editar", label: "Editar clientes" },
    ],
  },
  {
    id: "egresos",
    label: "Gastos",
    items: [
      { key: "egresos_ver", label: "Ver gastos" },
      { key: "egresos_crear", label: "Crear gastos" },
    ],
  },
  // Módulo Proveedores oculto del panel (permiso se conserva en DB por compatibilidad).
  {
    id: "inventario",
    label: "Inventario",
    items: [
      { key: "inventario_ver", label: "Ver inventario" },
      { key: "productos_crear", label: "Crear productos" },
      { key: "productos_editar", label: "Editar productos" },
      { key: "categorias_gestionar", label: "Gestionar categorías" },
      { key: "stock_actualizar", label: "Actualizar stock" },
      // Traslados ocultos del panel (permiso se conserva en DB).
    ],
  },
  {
    id: "caja",
    label: "Caja",
    items: [
      { key: "caja_ver", label: "Ver cierre de caja" },
      { key: "caja_gestionar", label: "Abrir y cerrar caja" },
    ],
  },
  {
    id: "administracion",
    label: "Administración",
    items: [
      { key: "roles_ver", label: "Ver roles" },
      { key: "colaboradores_gestionar", label: "Gestionar colaboradores" },
      { key: "sucursales_ver", label: "Ver sucursales" },
      { key: "sucursales_gestionar", label: "Gestionar sucursales" },
      { key: "actividades_ver", label: "Ver registros", readOnly: true },
    ],
  },
  {
    id: "kits",
    label: "Kits",
    items: [
      { key: "kits_ver", label: "Ver kits" },
      { key: "kits_gestionar", label: "Crear y editar kits" },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    items: [{ key: "marketing_ver", label: "Banners y cupones" }],
  },
  {
    id: "tienda",
    label: "Tienda",
    items: [
      {
        key: "ajustes_tienda_ver",
        label: "Ajustes de tienda, bienvenida y envíos",
      },
    ],
  },
];

function allTrue(): PermissionMap {
  const m: PermissionMap = {};
  for (const k of PERMISSION_KEYS) {
    m[k] = true;
  }
  return m;
}

function allFalse(): PermissionMap {
  const m: PermissionMap = {};
  for (const k of PERMISSION_KEYS) m[k] = false;
  return m;
}

/** Propietario: todo, incluidas ambas vistas de reportes. */
export function defaultPermissionsOwner(): PermissionMap {
  return allTrue();
}

/** Administrador: igual que propietario, sin “Cómo va la tienda”. */
export function defaultPermissionsAdmin(): PermissionMap {
  const m = allTrue();
  m.reportes_tienda = false;
  return m;
}

/** Venta: caja, ventas y piso; sin reportes ni administración. */
export function defaultPermissionsSales(): PermissionMap {
  const m = allFalse();
  m.ventas_ver = true;
  m.ventas_crear = true;
  m.creditos_ver = true;
  m.creditos_abonar = true;
  m.clientes_ver = true;
  m.clientes_crear = true;
  m.clientes_editar = true;
  m.egresos_ver = true;
  m.egresos_crear = true;
  m.proveedores_ver = true;
  m.inventario_ver = true;
  m.kits_ver = true;
  m.caja_ver = true;
  m.caja_gestionar = true;
  m.actividades_ver = true;
  return m;
}

/** Inventario: solo productos (catálogo, categorías y stock). */
export function defaultPermissionsInventory(): PermissionMap {
  const m = allFalse();
  m.inventario_ver = true;
  m.productos_crear = true;
  m.productos_editar = true;
  m.categorias_gestionar = true;
  m.stock_actualizar = true;
  return m;
}

/** Cocinero: ve pedidos / cocina; no caja ni reportes. */
export function defaultPermissionsKitchen(): PermissionMap {
  const m = allFalse();
  m.ventas_ver = true;
  return m;
}

/** Mesero / servicio: toma y atiende pedidos en salón. */
export function defaultPermissionsService(): PermissionMap {
  const m = allFalse();
  m.ventas_ver = true;
  m.ventas_crear = true;
  m.clientes_ver = true;
  return m;
}

export function permissionsFromRoleTemplate(
  role: CollaboratorJobRole,
): PermissionMap {
  if (role === "owner") return defaultPermissionsOwner();
  if (role === "admin") return defaultPermissionsAdmin();
  if (role === "inventory") return defaultPermissionsInventory();
  if (role === "kitchen") return defaultPermissionsKitchen();
  if (role === "service") return defaultPermissionsService();
  return defaultPermissionsSales();
}

export function normalizePermissions(raw: unknown): PermissionMap {
  if (!raw || typeof raw !== "object") return {};
  const out: PermissionMap = {};
  for (const k of PERMISSION_KEYS) {
    if (k in (raw as object)) {
      out[k] = Boolean((raw as Record<string, unknown>)[k]);
    }
  }
  return out;
}

export function mergePermissionsWithDefaults(
  stored: PermissionMap | null | undefined,
  fallbackRole: CollaboratorJobRole,
): PermissionMap {
  const base = permissionsFromRoleTemplate(fallbackRole);
  const s = stored ?? {};
  const out: PermissionMap = { ...base };
  for (const k of PERMISSION_KEYS) {
    if (k in s) out[k] = Boolean(s[k]);
  }
  if (!out.inicio_reportes) out.reportes_tienda = false;
  return out;
}
