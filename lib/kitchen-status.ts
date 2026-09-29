/** Estados de cocina para pedidos POS (salón / domicilio). */

export type KitchenStatus =
  | "recibido"
  | "en_preparacion"
  | "listo"
  | "entregado";

export const KITCHEN_STATUSES: KitchenStatus[] = [
  "recibido",
  "en_preparacion",
  "listo",
  "entregado",
];

export function isKitchenStatus(v: string): v is KitchenStatus {
  return (KITCHEN_STATUSES as string[]).includes(v);
}

/** Etiqueta corta para UI. `serviceType` ajusta el último paso. */
export function kitchenStatusLabel(
  status: KitchenStatus,
  serviceType?: "domicilio" | "en_el_lugar" | null,
): string {
  switch (status) {
    case "recibido":
      return "Recibido";
    case "en_preparacion":
      return "En preparación";
    case "listo":
      return "Listo";
    case "entregado":
      return serviceType === "domicilio" ? "Entregado" : "Servido";
    default:
      return status;
  }
}

export function kitchenStatusHint(status: KitchenStatus): string {
  switch (status) {
    case "recibido":
      return "El pedido llegó a cocina.";
    case "en_preparacion":
      return "Se está preparando ahora.";
    case "listo":
      return "Listo para servir o entregar.";
    case "entregado":
      return "Ya salió de cocina / se entregó al cliente.";
    default:
      return "";
  }
}

/**
 * Paleta única de cocina (lista + detalle).
 * Recibido (zinc) → En preparación (coral) → Listo (ámbar) → Servido/Entregado (verde).
 */
export type KitchenStatusColors = {
  /** Pastilla lista / botón activo en detalle. */
  badge: string;
  /** Título del estado actual en el panel Cocina. */
  title: string;
  /** Botón inactivo (misma familia de color, más suave). */
  buttonIdle: string;
};

export const KITCHEN_STATUS_COLORS: Record<KitchenStatus, KitchenStatusColors> =
  {
    recibido: {
      badge:
        "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-600/60",
      title: "text-zinc-800 dark:text-zinc-100",
      buttonIdle:
        "border border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
    },
    en_preparacion: {
      badge:
        "bg-[color-mix(in_srgb,var(--admin-coral)_16%,white)] text-[var(--admin-coral)] ring-1 ring-[color-mix(in_srgb,var(--admin-coral)_35%,transparent)] dark:bg-[color-mix(in_srgb,var(--admin-coral)_22%,#18181b)] dark:text-[color-mix(in_srgb,var(--admin-coral)_90%,white)] dark:ring-[color-mix(in_srgb,var(--admin-coral)_40%,transparent)]",
      title: "text-[var(--admin-coral)]",
      buttonIdle:
        "border border-[color-mix(in_srgb,var(--admin-coral)_35%,transparent)] bg-[color-mix(in_srgb,var(--admin-coral)_8%,white)] text-[var(--admin-coral)] hover:bg-[color-mix(in_srgb,var(--admin-coral)_14%,white)] dark:border-[color-mix(in_srgb,var(--admin-coral)_40%,transparent)] dark:bg-[color-mix(in_srgb,var(--admin-coral)_12%,#18181b)] dark:text-[color-mix(in_srgb,var(--admin-coral)_90%,white)]",
    },
    listo: {
      badge:
        "bg-amber-50 text-amber-800 ring-1 ring-amber-200/90 dark:bg-amber-950/45 dark:text-amber-100 dark:ring-amber-800/50",
      title: "text-amber-700 dark:text-amber-300",
      buttonIdle:
        "border border-amber-200 bg-amber-50/70 text-amber-800 hover:bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-950/45",
    },
    entregado: {
      badge:
        "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/90 dark:bg-emerald-950/45 dark:text-emerald-100 dark:ring-emerald-700/50",
      title: "text-emerald-700 dark:text-emerald-400",
      buttonIdle:
        "border border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-100 dark:hover:bg-emerald-950/45",
    },
  };

export function kitchenStatusColors(status: KitchenStatus): KitchenStatusColors {
  return KITCHEN_STATUS_COLORS[status];
}

/** Badge de cocina para listados (misma paleta que el detalle). */
export function kitchenStatusTone(
  status: KitchenStatus,
  serviceType?: "domicilio" | "en_el_lugar" | null,
): { label: string; className: string } {
  const label = kitchenStatusLabel(status, serviceType);
  const colors = kitchenStatusColors(status);
  return {
    label,
    className: `inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide ${colors.badge}`,
  };
}

/** Clases del botón de estado en el panel Cocina (activo = badge sólido). */
export function kitchenStatusButtonClass(
  status: KitchenStatus,
  active: boolean,
): string {
  const colors = kitchenStatusColors(status);
  if (active) {
    return `${colors.badge} shadow-sm`;
  }
  return colors.buttonIdle;
}

/** Siguiente estado sugerido (avance lineal). */
export function nextKitchenStatus(
  current: KitchenStatus | null | undefined,
): KitchenStatus | null {
  const cur = current && isKitchenStatus(current) ? current : "recibido";
  const idx = KITCHEN_STATUSES.indexOf(cur);
  if (idx < 0 || idx >= KITCHEN_STATUSES.length - 1) return null;
  return KITCHEN_STATUSES[idx + 1]!;
}
