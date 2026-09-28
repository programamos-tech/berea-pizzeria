/**
 * El precio guardado en `products.price_cents` es la base **sin IVA**.
 * El precio final al cliente (POS / etiqueta con IVA) =
 *   base × (1 + IVA/100) cuando `has_vat`, con IVA **fijo** al tipo general CO (19 %).
 *
 * No se “ajusta” el porcentaje al bruto redondeado del catálogo: `vat_percent` en BD
 * queda en 19 para referencia; los cálculos usan siempre `SALE_VAT_PERCENT`.
 *
 * Cuenta: `storefront_config.charge_vat === false` apaga el IVA en toda la cuenta
 * (aunque el producto tenga `has_vat`). Si la clave no existe, el IVA sigue activo
 * (compatibilidad). Liaco se siembra con `charge_vat: false`.
 */

/** IVA general ventas bienes Colombia (información / cálculo único). */
export const SALE_VAT_PERCENT = 19;

/** Clave en `tenants.storefront_config`. */
export const CHARGE_VAT_CONFIG_KEY = "charge_vat" as const;

/**
 * Si la cuenta cobra IVA. `false` explícito = apagado; ausente/`true` = encendido
 * (comportamiento histórico).
 */
export function tenantChargesVat(storefrontConfig: unknown): boolean {
  if (
    !storefrontConfig ||
    typeof storefrontConfig !== "object" ||
    Array.isArray(storefrontConfig)
  ) {
    return true;
  }
  return (storefrontConfig as Record<string, unknown>)[CHARGE_VAT_CONFIG_KEY] !== false;
}

/** IVA efectivo del ítem: cuenta + flag del producto. */
export function effectiveHasVat(
  storefrontConfig: unknown,
  productHasVat: boolean | null | undefined,
): boolean {
  return tenantChargesVat(storefrontConfig) && Boolean(productHasVat);
}

export function unitPriceNetCents(price_cents: number): number {
  return Math.max(0, Math.round(Number(price_cents ?? 0)));
}

export function unitPriceGrossCents(
  price_cents: number,
  has_vat: boolean | null | undefined,
  _vat_percent: number | null | undefined,
): number {
  const base = unitPriceNetCents(price_cents);
  if (!has_vat) return base;
  return Math.round(base * (1 + SALE_VAT_PERCENT / 100));
}

export function unitVatAmountCents(
  price_cents: number,
  has_vat: boolean | null | undefined,
  _vat_percent: number | null | undefined,
): number {
  const net = unitPriceNetCents(price_cents);
  const gross = unitPriceGrossCents(price_cents, has_vat, null);
  return Math.max(0, gross - net);
}

function storefrontFlag(storefrontConfig: unknown, key: string): boolean {
  if (!storefrontConfig || typeof storefrontConfig !== "object" || Array.isArray(storefrontConfig)) {
    return false;
  }
  return (storefrontConfig as Record<string, unknown>)[key] === true;
}

export type PosPricePolicy = {
  /** Cobrar más que el precio de lista. */
  allowHigher: boolean;
  /** Cobrar menos que el precio de lista (hasta $0), con Cobrar o descuentos. */
  allowBelow: boolean;
};

/** Ambos apagados si la cuenta no guardó los flags. */
export function posPricePolicyFromConfig(storefrontConfig: unknown): PosPricePolicy {
  return {
    allowHigher: storefrontFlag(storefrontConfig, "pos_allow_higher_price"),
    allowBelow: storefrontFlag(storefrontConfig, "pos_allow_below_price"),
  };
}

export function posUnitViolatesPricePolicy(
  unitFinalGross: number,
  catalogGross: number,
  policy: PosPricePolicy,
): boolean {
  const unit = Math.max(0, Math.round(Number(unitFinalGross ?? 0)));
  const catalog = Math.max(0, Math.round(Number(catalogGross ?? 0)));
  if (unit < catalog) return !policy.allowBelow;
  if (unit > catalog) return !policy.allowHigher;
  return false;
}

/**
 * Unitario POS: catálogo, o el cobrado si el vendedor escribió un valor
 * (`null` = catálogo; `0` = gratis).
 * `gross` es el valor de ticket (con IVA si aplica) — el que debe ir a la factura.
 */
export function posCustomSaleUnits(
  catalogNetCents: number,
  hasVat: boolean | null | undefined,
  chargedGrossCents: number | null | undefined,
): { net: number; gross: number } {
  const catalogNet = unitPriceNetCents(catalogNetCents);
  const catalogGross = unitPriceGrossCents(catalogNet, hasVat, null);
  if (chargedGrossCents == null) return { net: catalogNet, gross: catalogGross };
  const charged = Math.round(Number(chargedGrossCents));
  if (!Number.isFinite(charged) || charged < 0) {
    return { net: catalogNet, gross: catalogGross };
  }
  return {
    net: unitNetFromPosChargedUnitCents(charged, hasVat, null),
    gross: charged,
  };
}

/** Etiqueta de IVA en UI (no usar `vat_percent` heredado con tasas “adaptadas”). */
export function saleVatPercentLabel(has_vat: boolean | null | undefined): number | null {
  return has_vat ? SALE_VAT_PERCENT : null;
}

/**
 * Unitario cobrado en POS (típico: **con IVA** en el ticket) → base sin IVA por unidad.
 * Si el producto no lleva IVA, el cobrado es la base.
 */
export function unitNetFromPosChargedUnitCents(
  chargedUnitCents: number,
  has_vat: boolean | null | undefined,
  _vat_percent: number | null | undefined,
): number {
  const g = Math.max(0, Math.round(Number(chargedUnitCents ?? 0)));
  if (!has_vat) return g;
  return Math.round(g / (1 + SALE_VAT_PERCENT / 100));
}
