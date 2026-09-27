import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { resolveActingCustomerTenant } from "@/lib/platform-operator-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEFAULT_TENANT_SLUG,
  publicHostname,
  resolveTenantFromHost,
  TENANT_SLUG_HEADER,
} from "@/lib/tenancy";
import {
  parseInvoiceLayout,
  type InvoiceLayout,
} from "@/lib/invoice-layout";
import {
  parseTenantBrand,
  tenantBrandToInvoiceFields,
  type InvoiceBrandFields,
} from "@/lib/tenant-brand";
import {
  buildStorefrontChrome,
  type StorefrontChrome,
} from "@/lib/storefront-brand";

export type TenantRef = {
  id: string;
  slug: string;
  name: string;
};

/**
 * Resolve the active tenant for this request (host header → tenants row).
 * Falls back to DEFAULT_TENANT_SLUG (berea-pizzerias) for local / unknown hosts.
 */
async function getRequestTenantUncached(): Promise<TenantRef> {
  const acting = await resolveActingCustomerTenant();
  if (acting) {
    return { id: acting.id, slug: acting.slug, name: acting.name };
  }

  const h = await headers();
  const fromMiddleware = h.get(TENANT_SLUG_HEADER)?.trim();
  const resolvedHost = resolveTenantFromHost(publicHostname(h));
  const fromHost = resolvedHost.slug;
  const slug = fromMiddleware || fromHost || DEFAULT_TENANT_SLUG;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("id, slug, name")
    .eq("slug", slug)
    .in("status", ["active", "trial"])
    .maybeSingle();

  if (error) {
    console.error("[tenancy] getRequestTenant:", error.message);
  }

  if (data?.id) {
    return { id: data.id, slug: data.slug, name: data.name };
  }

  if (slug !== DEFAULT_TENANT_SLUG || resolvedHost.kind === "unknown") {
    notFound();
  }

  // Hard fallback: default tenant for this product (Berea Pizzerías).
  const { data: fallback } = await supabase
    .from("tenants")
    .select("id, slug, name")
    .eq("slug", DEFAULT_TENANT_SLUG)
    .maybeSingle();

  if (!fallback?.id) {
    throw new Error(
      `Tenant "${slug}" not found and default "${DEFAULT_TENANT_SLUG}" missing`,
    );
  }

  return { id: fallback.id, slug: fallback.slug, name: fallback.name };
}

export const getRequestTenant = cache(getRequestTenantUncached);

async function getTenantBrandForRequestUncached(): Promise<InvoiceBrandFields> {
  const tenant = await getRequestTenant();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("brand")
    .eq("id", tenant.id)
    .maybeSingle();

  if (error) {
    console.error("[tenancy] getTenantBrandForRequest:", error.message);
  }

  return tenantBrandToInvoiceFields(parseTenantBrand(data?.brand));
}

/**
 * Invoice / tirilla brand for the current host’s tenant.
 * Empty `tenants.brand` → env defaults from `lib/brand.ts` (Aleya unchanged).
 */
export const getTenantBrandForRequest = cache(getTenantBrandForRequestUncached);

async function getInvoiceLayoutForRequestUncached(): Promise<InvoiceLayout> {
  const tenant = await getRequestTenant();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("storefront_config")
    .eq("id", tenant.id)
    .maybeSingle();

  if (error) {
    console.error("[tenancy] getInvoiceLayoutForRequest:", error.message);
  }

  return parseInvoiceLayout(data?.storefront_config);
}

/** Formato de impresión de facturas del tenant (`ticket` o `letter`). */
export const getInvoiceLayoutForRequest = cache(
  getInvoiceLayoutForRequestUncached,
);

async function getStorefrontChromeForRequestUncached(): Promise<StorefrontChrome> {
  const tenant = await getRequestTenant();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("brand,storefront_config")
    .eq("id", tenant.id)
    .maybeSingle();

  if (error) {
    console.error("[tenancy] getStorefrontChromeForRequest:", error.message);
  }

  return buildStorefrontChrome({
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    brandRaw: data?.brand,
    storefrontConfigRaw: data?.storefront_config,
  });
}

export const getStorefrontChromeForRequest = cache(
  getStorefrontChromeForRequestUncached,
);
