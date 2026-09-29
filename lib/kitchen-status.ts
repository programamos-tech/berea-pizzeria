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

/** Color de letra para listados (sin pastilla). */
export function kitchenStatusTone(
  status: KitchenStatus,
  serviceType?: "domicilio" | "en_el_lugar" | null,
): { label: string; className: string } {
  const label = kitchenStatusLabel(status, serviceType);
  switch (status) {
    case "entregado":
      return {
        label,
        className: "font-semibold text-emerald-700 dark:text-emerald-400",
      };
    case "listo":
      return {
        label,
        className: "font-semibold text-teal-700 dark:text-teal-400",
      };
    case "en_preparacion":
      return {
        label,
        className: "font-semibold text-[var(--admin-coral)]",
      };
    default:
      return {
        label,
        className: "font-semibold text-zinc-700 dark:text-zinc-300",
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
