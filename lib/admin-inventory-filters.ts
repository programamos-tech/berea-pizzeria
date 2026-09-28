/** Parse query-string filter params shared by Inventario listados. */

export function spString(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const raw = sp[key];
  const v = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  return (v ?? "").trim();
}

export function filterIngredients<
  T extends {
    name: string;
    is_active: boolean;
    unit: string;
    category_key?: string;
  },
>(
  rows: T[],
  opts: { q: string; status: string; unit: string; category?: string },
): T[] {
  const q = opts.q.toLowerCase();
  const status = opts.status || "all";
  const unit = opts.unit.toLowerCase();
  const category = (opts.category ?? "").toLowerCase();

  return rows.filter((row) => {
    if (q && !row.name.toLowerCase().includes(q)) return false;
    if (status === "active" && !row.is_active) return false;
    if (status === "inactive" && row.is_active) return false;
    if (unit && row.unit.toLowerCase() !== unit) return false;
    if (
      category &&
      String(row.category_key ?? "").toLowerCase() !== category
    ) {
      return false;
    }
    return true;
  });
}

export function filterRecipes<
  T extends { name: string; kind: string; category_key: string },
>(
  rows: T[],
  opts: { q: string; kind: string; category: string },
): T[] {
  const q = opts.q.toLowerCase();
  const kind = opts.kind || "all";
  const category = opts.category.toLowerCase();

  return rows.filter((row) => {
    if (q && !row.name.toLowerCase().includes(q)) return false;
    if (kind !== "all" && row.kind !== kind) return false;
    if (category && row.category_key.toLowerCase() !== category) return false;
    return true;
  });
}
