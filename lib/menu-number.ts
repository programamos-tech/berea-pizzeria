/** Número corto de menú por tenant (`products.menu_number`). */

export function formatMenuNumber(
  menuNumber: number | null | undefined,
): string {
  const n = Number(menuNumber);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return String(Math.floor(n));
}

/** Etiqueta con # para tooltips / acciones (ej. "#12"). */
export function formatMenuNumberLabel(
  menuNumber: number | null | undefined,
): string {
  const s = formatMenuNumber(menuNumber);
  return s === "—" ? s : `#${s}`;
}
