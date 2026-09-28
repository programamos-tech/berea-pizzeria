/**
 * Tipo de ítem del menú Liaco:
 * - **Elaborado**: tiene receta con BOM (líneas de insumos / sub-recetas).
 * - **Reventa**: sin receta, o receta vacía (bebidas embotelladas, etc.).
 *
 * No hay columna `menu_kind` aparte: se deriva de `products.recipe_id`
 * (+ variantes) y del conteo de `recipe_lines`.
 */

export type MenuItemKind = "elaborado" | "reventa";

export const MENU_ITEM_KIND_LABEL: Record<MenuItemKind, string> = {
  elaborado: "Elaborado",
  reventa: "Reventa",
};

export function menuItemKindFromBomCount(bomLineCount: number): MenuItemKind {
  return bomLineCount > 0 ? "elaborado" : "reventa";
}

export function menuItemKindLabel(kind: MenuItemKind): string {
  return MENU_ITEM_KIND_LABEL[kind];
}
