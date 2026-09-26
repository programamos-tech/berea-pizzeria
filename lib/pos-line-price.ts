import { unitPriceAfterWholesaleCents } from "@/lib/customer-wholesale-pricing";
import {
  applyPosLineNetDiscountCents,
  discountedUnitNetCentsFromLine,
} from "@/lib/pos-line-discount";
import {
  posCustomSaleUnits,
  posUnitViolatesPricePolicy,
  unitPriceGrossCents,
  type PosPricePolicy,
} from "@/lib/product-vat-price";

export const POS_PRICE_NOT_ALLOWED_MESSAGE =
  "No se puede vender a ese precio.";

export function computePosProductLineAmounts(opts: {
  priceCatalog: number;
  hasVat: boolean;
  wholesalePct: number;
  quantity: number;
  /** `null` = precio de catálogo; `0` = gratis. */
  chargedUnitCents: number | null | undefined;
  discountPercent: number | null | undefined;
  discountAmountCents: number | null | undefined;
  policy: PosPricePolicy;
}): {
  catalogGross: number;
  lineNetBefore: number;
  lineNetAfter: number;
  unitFinal: number;
  discountInvalid: boolean;
  violatesPolicy: boolean;
} {
  const quantity = Math.max(1, Math.floor(Number(opts.quantity ?? 1)));
  const catalogNet = unitPriceAfterWholesaleCents(
    opts.priceCatalog,
    opts.wholesalePct,
  );
  const catalogGross = unitPriceGrossCents(catalogNet, opts.hasVat, null);
  const chargedRaw = opts.chargedUnitCents;
  const chargedUnitCents =
    chargedRaw != null && Number.isFinite(Number(chargedRaw)) && Number(chargedRaw) >= 0
      ? Math.floor(Number(chargedRaw))
      : null;
  const custom = posCustomSaleUnits(catalogNet, opts.hasVat, chargedUnitCents);
  const lineNetBefore = custom.net * quantity;
  const pctForCalc =
    opts.discountPercent != null &&
    Number(opts.discountPercent) > 0 &&
    Number(opts.discountPercent) <= 100
      ? Math.floor(Number(opts.discountPercent))
      : null;
  const amtForCalc =
    pctForCalc != null
      ? 0
      : Math.max(0, Math.floor(Number(opts.discountAmountCents ?? 0)));
  const discountInvalid = amtForCalc > lineNetBefore;
  const lineNetAfter = applyPosLineNetDiscountCents(
    lineNetBefore,
    pctForCalc,
    amtForCalc,
  );
  const hasDiscount = lineNetAfter < lineNetBefore;
  const discNetUnit = discountedUnitNetCentsFromLine(lineNetAfter, quantity);
  const unitFinal = hasDiscount
    ? unitPriceGrossCents(discNetUnit, opts.hasVat, null)
    : custom.gross;
  return {
    catalogGross,
    lineNetBefore,
    lineNetAfter,
    unitFinal,
    discountInvalid,
    violatesPolicy: posUnitViolatesPricePolicy(
      unitFinal,
      catalogGross,
      opts.policy,
    ),
  };
}
