/**
 * Shape of `tenants.brand` jsonb — invoice / tirilla fields for Berea Pizzerías.
 * Empty or partial brand falls back to env defaults in `lib/brand.ts` (Aleya).
 *
 * Logo convention: public path (`/logo-….png`) or Storage object path
 * `product-images/tenants/{tenant_id}/logo.{ext}` (bucket `product-images`).
 */

import {
  adminTenantLogoPath,
  invoiceLegalName as envInvoiceLegalName,
  invoiceLogoPath as envInvoiceLogoPath,
  invoiceStoreAddress as envInvoiceStoreAddress,
  invoiceStoreCity as envInvoiceStoreCity,
  invoiceTaxNit as envInvoiceTaxNit,
  invoiceTradeName as envInvoiceTradeName,
  storeSupportEmail as envStoreSupportEmail,
  storeSupportHours as envStoreSupportHours,
  storeSupportPhone as envStoreSupportPhone,
  storeTaxRegime as envStoreTaxRegime,
} from "@/lib/brand";
import { storagePublicObjectUrl } from "@/lib/storage-public-url";

export type TenantBrandBank = {
  holder?: string;
  tax_id?: string;
  account?: string;
};

export type TenantBrand = {
  trade_name?: string;
  legal_name?: string;
  tax_nit?: string;
  tax_regime?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  address?: string;
  city?: string;
  /** Public `/…` or Storage `product-images/tenants/…`. */
  logo_path?: string;
  primary_color?: string;
  tagline?: string;
  description?: string;
  announcement?: string;
  support_hours?: string;
  instagram_url?: string;
  bank?: TenantBrandBank;
};

/** Resolved fields used by printed invoice / cotización / tirilla. */
export type InvoiceBrandFields = {
  invoiceTradeName: string;
  invoiceLegalName: string;
  invoiceTaxNit: string;
  storeTaxRegime: string;
  invoiceStoreAddress: string;
  invoiceStoreCity: string;
  /** Browser/print src: public path or absolute Storage URL. */
  invoiceLogoSrc: string;
  /** Original path as stored (public or storage key). */
  invoiceLogoPath: string;
  storeSupportPhone: string;
  storeSupportEmail: string;
  storeSupportHours: string;
  whatsapp?: string;
  bank?: TenantBrandBank;
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidTenantSlug(slug: string): boolean {
  return slug.length >= 2 && slug.length <= 48 && SLUG_RE.test(slug);
}

function asTrimmedString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function parseBank(raw: unknown): TenantBrandBank | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const holder = asTrimmedString(o.holder);
  const tax_id = asTrimmedString(o.tax_id);
  const account = asTrimmedString(o.account);
  if (!holder && !tax_id && !account) return undefined;
  return { holder, tax_id, account };
}

/** Parse DB jsonb (or unknown) into a typed TenantBrand. */
export function parseTenantBrand(raw: unknown): TenantBrand {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const brand: TenantBrand = {
    trade_name: asTrimmedString(o.trade_name),
    legal_name: asTrimmedString(o.legal_name),
    tax_nit: asTrimmedString(o.tax_nit),
    tax_regime: asTrimmedString(o.tax_regime),
    phone: asTrimmedString(o.phone),
    email: asTrimmedString(o.email),
    whatsapp: asTrimmedString(o.whatsapp),
    address: asTrimmedString(o.address),
    city: asTrimmedString(o.city),
    logo_path: asTrimmedString(o.logo_path),
    primary_color: asTrimmedString(o.primary_color),
    tagline: asTrimmedString(o.tagline),
    description: asTrimmedString(o.description),
    announcement: asTrimmedString(o.announcement),
    support_hours: asTrimmedString(o.support_hours),
    instagram_url: asTrimmedString(o.instagram_url),
    bank: parseBank(o.bank),
  };
  return brand;
}

/**
 * Resolve logo for `<img>` / email: Storage keys → public URL; `/public` paths unchanged.
 */
export function resolveInvoiceLogoSrc(logoPath: string): string {
  const p = logoPath.trim();
  if (!p) return envInvoiceLogoPath;
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith("/")) return p;
  return storagePublicObjectUrl(p) ?? p;
}

const ACCOUNT_LOGO_BY_SLUG: Record<string, string> = {
  aleya: "/logo-aleya-wordmark.png",
  "estacion-iphone": "/logo-estacion-iphone.png",
  "berea-tech": "/logo-berea-house-mark.png",
  "toro-technology": "/logo-toro-technology.jpg",
  "audio-mundial": "/logo-audio-mundial.png",
  liaco: "/logo-liaco-stacked.png",
};

export type AdminAccountChrome = {
  name: string;
  logoSrc: string;
  /** Fondo del recuadro del logo en backoffice (color de marca). */
  plateColor: string;
  /** Logo a color (no se convierte a blanco). */
  logoFullColor: boolean;
  /** Marca cuadrada: la tienda lo muestra más alto que un wordmark. */
  logoSquare: boolean;
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const ACCOUNT_PLATE_BY_SLUG: Record<string, string> = {
  aleya: "#FF76A1",
  "estacion-iphone": "#111111",
  "berea-tech": "#0F766E",
  "toro-technology": "#111111",
  "audio-mundial": "#ffffff",
  liaco: "#ffffff",
};

const ACCOUNT_FULL_COLOR_LOGO = new Set([
  "toro-technology",
  "audio-mundial",
  "liaco",
]);

export function adminLogoPlateColor(
  slug: string,
  primaryColor?: string,
): string {
  const color = String(primaryColor ?? "").trim();
  if (HEX_COLOR.test(color)) return color.toUpperCase();
  return ACCOUNT_PLATE_BY_SLUG[slug] ?? "#18181B";
}

/** Logo and trade name for the admin sidebar / account picker. */
export function adminAccountChrome(input: {
  slug: string;
  name: string;
  brand?: unknown;
}): AdminAccountChrome {
  const parsed = parseTenantBrand(input.brand);
  const logoPath =
    parsed.logo_path || ACCOUNT_LOGO_BY_SLUG[input.slug] || "";
  const logoFullColor = ACCOUNT_FULL_COLOR_LOGO.has(input.slug);
  return {
    name: parsed.trade_name || input.name,
    logoSrc: logoPath
      ? resolveInvoiceLogoSrc(logoPath)
      : adminTenantLogoPath,
    plateColor: adminLogoPlateColor(input.slug, parsed.primary_color),
    logoFullColor,
    logoSquare: logoFullColor,
  };
}

/** Merge tenant brand over env defaults (Aleya / legacy). */
export function tenantBrandToInvoiceFields(
  brand: TenantBrand | null | undefined,
): InvoiceBrandFields {
  const b = brand ?? {};
  const invoiceLogoPath = b.logo_path || envInvoiceLogoPath;
  return {
    invoiceTradeName: b.trade_name || envInvoiceTradeName,
    invoiceLegalName: b.legal_name || envInvoiceLegalName,
    invoiceTaxNit: b.tax_nit || envInvoiceTaxNit,
    storeTaxRegime: b.tax_regime || envStoreTaxRegime,
    invoiceStoreAddress: b.address ?? envInvoiceStoreAddress,
    invoiceStoreCity: b.city ?? envInvoiceStoreCity,
    invoiceLogoPath,
    invoiceLogoSrc: resolveInvoiceLogoSrc(invoiceLogoPath),
    storeSupportPhone: b.phone || envStoreSupportPhone,
    storeSupportEmail: b.email || envStoreSupportEmail,
    storeSupportHours: envStoreSupportHours,
    whatsapp: b.whatsapp,
    bank: b.bank,
  };
}

/** Build jsonb payload for insert/update from onboarding form fields. */
export function buildTenantBrandJson(input: {
  tradeName: string;
  legalName: string;
  taxNit: string;
  taxRegime: string;
  phone: string;
  email: string;
  whatsapp?: string;
  address: string;
  city: string;
  logoPath?: string;
  bankHolder?: string;
  bankTaxId?: string;
  bankAccount?: string;
}): TenantBrand {
  const brand: TenantBrand = {
    trade_name: input.tradeName.trim() || undefined,
    legal_name: input.legalName.trim() || undefined,
    tax_nit: input.taxNit.trim() || undefined,
    tax_regime: input.taxRegime.trim() || undefined,
    phone: input.phone.trim() || undefined,
    email: input.email.trim() || undefined,
    whatsapp: input.whatsapp?.trim() || undefined,
    address: input.address.trim() || undefined,
    city: input.city.trim() || undefined,
    logo_path: input.logoPath?.trim() || undefined,
  };
  const holder = input.bankHolder?.trim();
  const tax_id = input.bankTaxId?.trim();
  const account = input.bankAccount?.trim();
  if (holder || tax_id || account) {
    brand.bank = { holder, tax_id, account };
  }
  return brand;
}
