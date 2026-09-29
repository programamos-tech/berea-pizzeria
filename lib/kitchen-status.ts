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
 * Badge de cocina para listados — cada estado con color propio.
 * Recibido (zinc) → En preparación (coral) → Listo (ámbar) → Servido/Entregado (verde).
 */
export function kitchenStatusTone(
  status: KitchenStatus,
  serviceType?: "domicilio" | "en_el_lugar" | null,
): { label: string; className: string } {
  const label = kitchenStatusLabel(status, serviceType);
  const base =
    "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide";
  switch (status) {
    case "recibido":
      return {
        label,
        className: `${base} bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-600/60`,
      };
    case "en_preparacion":
      return {
        label,
        className: `${base} bg-[color-mix(in_srgb,var(--admin-coral)_16%,white)] text-[var(--admin-coral)] ring-1 ring-[color-mix(in_srgb,var(--admin-coral)_35%,transparent)] dark:bg-[color-mix(in_srgb,var(--admin-coral)_22%,#18181b)] dark:text-[color-mix(in_srgb,var(--admin-coral)_90%,white)]`,
      };
    case "listo":
      return {
        label,
        className: `${base} bg-amber-50 text-amber-800 ring-1 ring-amber-200/90 dark:bg-amber-950/45 dark:text-amber-100 dark:ring-amber-800/50`,
      };
    case "entregado":
      return {
        label,
        className: `${base} bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/90 dark:bg-emerald-950/45 dark:text-emerald-100 dark:ring-emerald-700/50`,
      };
    default:
      return {
        label,
        className: `${base} bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200`,
      };
  }
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
