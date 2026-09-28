import { slugifyIngredientName } from "@/lib/ingredient-units";

export const RECIPE_KINDS = ["prep", "menu"] as const;
export type RecipeKind = (typeof RECIPE_KINDS)[number];

export const RECIPE_CATEGORY_PRESETS = [
  "masas",
  "salsas",
  "pizzas",
  "panouzzos",
  "strombolis",
  "lasanas",
  "limonadas",
  "bebidas",
  "postres",
  "adiciones",
  "preparaciones",
] as const;

/** Etiquetas legibles (manual §§1–12). */
const RECIPE_CATEGORY_LABELS: Record<string, string> = {
  masas: "Masas (§1–2)",
  salsas: "Salsas (§3–4)",
  pizzas: "Pizzas (§5)",
  panouzzos: "Panouzzos (§6)",
  lasanas: "Lasañas (§7)",
  strombolis: "Strombolis (§8)",
  limonadas: "Limonadas (§9)",
  postres: "Postres (§10)",
  bebidas: "Bebidas (§11)",
  adiciones: "Adiciones (§12)",
  preparaciones: "Preparaciones",
};

export const RECIPE_LINE_UNITS = [
  "g",
  "ml",
  "oz",
  "lb",
  "l",
  "unidad",
  "al_gusto",
  "porcion",
  "lote",
] as const;

export type RecipeBomLineInput = {
  ingredientId: string | null;
  componentRecipeId: string | null;
  quantity: number;
  unit: string;
  isOptional: boolean;
  note: string;
  sortOrder: number;
};

export function slugifyRecipeName(name: string): string {
  return slugifyIngredientName(name);
}

export function isRecipeKind(raw: string): raw is RecipeKind {
  return (RECIPE_KINDS as readonly string[]).includes(raw);
}

export function normalizeCategoryKey(raw: string): string {
  const s = String(raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return s || "preparaciones";
}

export function recipeCategoryLabel(key: string): string {
  const k = normalizeCategoryKey(key);
  return RECIPE_CATEGORY_LABELS[k] ?? (k ? k.replace(/-/g, " ") : "—");
}

export function recipeKindLabel(kind: string): string {
  return kind === "prep" ? "Preparación" : "Menú";
}

/** Parse BOM lines from form fields `line_count` + `line_N_*`. */
export function parseRecipeBomLinesFromFormData(
  formData: FormData,
): RecipeBomLineInput[] {
  const count = Math.min(
    80,
    Math.max(0, Math.floor(Number(formData.get("line_count") ?? 0))),
  );
  const lines: RecipeBomLineInput[] = [];
  for (let i = 0; i < count; i++) {
    const ingredientId = String(
      formData.get(`line_${i}_ingredient_id`) ?? "",
    ).trim();
    const componentRecipeId = String(
      formData.get(`line_${i}_component_recipe_id`) ?? "",
    ).trim();
    const qtyRaw = String(formData.get(`line_${i}_quantity`) ?? "")
      .replace(",", ".")
      .trim();
    const quantity = Number(qtyRaw);
    const unit = String(formData.get(`line_${i}_unit`) ?? "g")
      .trim()
      .toLowerCase() || "g";
    const isOptional = formData.get(`line_${i}_optional`) === "on";
    const note = String(formData.get(`line_${i}_note`) ?? "")
      .trim()
      .slice(0, 240);

    if (!ingredientId && !componentRecipeId) continue;
    if (ingredientId && componentRecipeId) continue;
    if (!Number.isFinite(quantity) || quantity < 0) continue;

    lines.push({
      ingredientId: ingredientId || null,
      componentRecipeId: componentRecipeId || null,
      quantity: Math.round(quantity * 10000) / 10000,
      unit: unit.slice(0, 24),
      isOptional,
      note,
      sortOrder: (i + 1) * 10,
    });
  }
  return lines;
}
