export const PRODUCT_CATALOG_FIELDS = [
  { id: "brand", label: "Marca", hint: "Fabricante o marca del producto." },
  { id: "category", label: "Categoría", hint: "Para agrupar el catálogo." },
  { id: "sizes", label: "Tamaños", hint: "Presentaciones, como 250 ml o 1 kg." },
  { id: "colors", label: "Colores", hint: "Variantes de color disponibles." },
  { id: "fragrances", label: "Fragancias", hint: "Aromas disponibles, con foto opcional." },
  { id: "expiration", label: "Vencimiento", hint: "Fecha de vencimiento del producto." },
] as const;

export type ProductCatalogFieldId = (typeof PRODUCT_CATALOG_FIELDS)[number]["id"];

export type ProductCatalogFields = Record<ProductCatalogFieldId, boolean>;

export function defaultProductCatalogFields(): ProductCatalogFields {
  return {
    brand: true,
    category: true,
    sizes: true,
    colors: true,
    fragrances: true,
    expiration: true,
  };
}

export function isProductCatalogFieldId(raw: string): raw is ProductCatalogFieldId {
  return PRODUCT_CATALOG_FIELDS.some((field) => field.id === raw);
}

export function parseProductCatalogFields(raw: unknown): ProductCatalogFields {
  const fields = defaultProductCatalogFields();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fields;
  const config = raw as Record<string, unknown>;
  const stored = config.product_fields;
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return fields;
  const map = stored as Record<string, unknown>;
  for (const field of PRODUCT_CATALOG_FIELDS) {
    if (typeof map[field.id] === "boolean") fields[field.id] = map[field.id] as boolean;
  }
  return fields;
}

/** Quita del guardado los campos apagados para no borrar lo que ya tenía el producto. */
export function omitDisabledProductCatalogFields(
  row: Record<string, unknown>,
  fields: ProductCatalogFields,
): Record<string, unknown> {
  const next = { ...row };
  if (!fields.brand) delete next.brand;
  if (!fields.category) delete next.category_id;
  if (!fields.sizes) {
    delete next.size_options;
    delete next.size_value;
    delete next.size_unit;
  }
  if (!fields.colors) delete next.colors;
  if (!fields.fragrances) {
    delete next.fragrance_options;
    delete next.fragrance_option_images;
  }
  if (!fields.expiration) {
    delete next.has_expiration;
    delete next.expiration_date;
  }
  return next;
}
