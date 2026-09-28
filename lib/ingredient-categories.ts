/** Categorías de insumos (Inventario → Insumos), alineadas al manual Liaco. */

export const INGREDIENT_CATEGORY_PRESETS = [
  "harinas",
  "lacteos",
  "carnes",
  "vegetales",
  "bebidas",
  "especias",
  "salsas",
  "basicos",
  "panaderia",
  "preparaciones",
  "postres",
  "otros",
] as const;

export type IngredientCategoryKey =
  (typeof INGREDIENT_CATEGORY_PRESETS)[number];

const LABELS: Record<string, string> = {
  harinas: "Harinas",
  lacteos: "Lácteos",
  carnes: "Carnes",
  vegetales: "Vegetales",
  bebidas: "Bebidas",
  especias: "Especias y hierbas",
  salsas: "Salsas y condimentos",
  basicos: "Básicos",
  panaderia: "Panadería / pasta",
  preparaciones: "Semi-elaborados",
  postres: "Postres",
  otros: "Otros",
};

export function ingredientCategoryLabel(key: string): string {
  const k = normalizeIngredientCategoryKey(key);
  return LABELS[k] ?? (k ? k.replace(/-/g, " ") : "Otros");
}

export function normalizeIngredientCategoryKey(raw: string): string {
  const s = String(raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  if (!s) return "otros";
  if ((INGREDIENT_CATEGORY_PRESETS as readonly string[]).includes(s)) {
    return s;
  }
  return s;
}

export function isIngredientCategoryKey(
  raw: string,
): raw is IngredientCategoryKey {
  return (INGREDIENT_CATEGORY_PRESETS as readonly string[]).includes(raw);
}
