/** Unidades permitidas en `ingredients.unit` (migración Liaco). */
export const INGREDIENT_UNITS = [
  "g",
  "ml",
  "oz",
  "lb",
  "l",
  "unidad",
  "al_gusto",
] as const;

export type IngredientUnit = (typeof INGREDIENT_UNITS)[number];

export function isIngredientUnit(raw: string): raw is IngredientUnit {
  return (INGREDIENT_UNITS as readonly string[]).includes(raw);
}

export function slugifyIngredientName(name: string): string {
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
