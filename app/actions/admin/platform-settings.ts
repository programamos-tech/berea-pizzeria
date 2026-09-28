"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  parseDisabledAccountModules,
  withModuleDisabled,
} from "@/lib/admin-account-modules";
import { parseInvoiceLayout } from "@/lib/invoice-layout";
import {
  isProductCatalogFieldId,
  parseProductCatalogFields,
} from "@/lib/product-catalog-fields";
import { requireAdminSession } from "@/lib/require-admin-permission";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function updateInvoiceLayoutAction(formData: FormData) {
  const session = await requireAdminSession();
  if (session.jobRole !== "owner" && !session.isPlatformOperator) {
    redirect("/admin/configuracion?notice=forbidden");
  }

  const layout = parseInvoiceLayout(String(formData.get("invoice_layout") ?? ""));
  const supabase = await createSupabaseServerClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("storefront_config")
    .eq("id", session.tenantId)
    .maybeSingle();
  if (!tenant) redirect("/admin/configuracion?notice=error");

  const current =
    tenant.storefront_config &&
    typeof tenant.storefront_config === "object" &&
    !Array.isArray(tenant.storefront_config)
      ? (tenant.storefront_config as Record<string, unknown>)
      : {};

  const { error } = await supabase
    .from("tenants")
    .update({
      storefront_config: {
        ...current,
        invoice_layout: layout,
      },
    })
    .eq("id", session.tenantId);
  if (error) redirect("/admin/configuracion?notice=error");

  revalidatePath("/admin", "layout");
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/orders");
  redirect("/admin/configuracion?notice=saved");
}

export async function updateKitsEnabledAction(
  enabled: boolean,
): Promise<{ ok: true } | { ok: false }> {
  const session = await requireAdminSession();
  if (session.jobRole !== "owner" && !session.isPlatformOperator) {
    return { ok: false };
  }

  let service: ReturnType<typeof createSupabaseServiceClient>;
  try {
    service = createSupabaseServiceClient();
  } catch {
    return { ok: false };
  }

  const { data: tenant } = await service
    .from("tenants")
    .select("id, disabled_modules")
    .eq("id", session.tenantId)
    .maybeSingle();
  if (!tenant?.id) return { ok: false };

  const next = withModuleDisabled(
    parseDisabledAccountModules(tenant.disabled_modules),
    "kits",
    enabled,
  );

  const { data: updated, error } = await service
    .from("tenants")
    .update({ disabled_modules: next })
    .eq("id", tenant.id)
    .select("id")
    .maybeSingle();
  if (error || !updated?.id) return { ok: false };

  revalidatePath("/admin", "layout");
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/kits");
  revalidatePath("/admin/ventas/nueva");
  return { ok: true };
}

export async function updateProductCatalogFieldAction(
  fieldId: string,
  enabled: boolean,
): Promise<{ ok: true } | { ok: false }> {
  const session = await requireAdminSession();
  if (session.jobRole !== "owner" && !session.isPlatformOperator) {
    return { ok: false };
  }
  if (!isProductCatalogFieldId(fieldId)) return { ok: false };

  let service: ReturnType<typeof createSupabaseServiceClient>;
  try {
    service = createSupabaseServiceClient();
  } catch {
    return { ok: false };
  }

  const { data: tenant } = await service
    .from("tenants")
    .select("storefront_config")
    .eq("id", session.tenantId)
    .maybeSingle();
  if (!tenant) return { ok: false };

  const current =
    tenant.storefront_config &&
    typeof tenant.storefront_config === "object" &&
    !Array.isArray(tenant.storefront_config)
      ? (tenant.storefront_config as Record<string, unknown>)
      : {};
  const fields = parseProductCatalogFields(current);
  fields[fieldId] = enabled;

  const { data: updated, error } = await service
    .from("tenants")
    .update({
      storefront_config: {
        ...current,
        product_fields: fields,
      },
    })
    .eq("id", session.tenantId)
    .select("id")
    .maybeSingle();
  if (error || !updated?.id) return { ok: false };

  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/products");
  return { ok: true };
}

export type PosPriceFlag = "higher" | "below";

const POS_PRICE_FLAG_KEYS: Record<PosPriceFlag, string> = {
  higher: "pos_allow_higher_price",
  below: "pos_allow_below_price",
};

export async function updateChargeVatAction(
  enabled: boolean,
): Promise<{ ok: true } | { ok: false }> {
  const session = await requireAdminSession();
  if (session.jobRole !== "owner" && !session.isPlatformOperator) {
    return { ok: false };
  }

  let service: ReturnType<typeof createSupabaseServiceClient>;
  try {
    service = createSupabaseServiceClient();
  } catch {
    return { ok: false };
  }

  const { data: tenant } = await service
    .from("tenants")
    .select("storefront_config")
    .eq("id", session.tenantId)
    .maybeSingle();
  if (!tenant) return { ok: false };

  const current =
    tenant.storefront_config &&
    typeof tenant.storefront_config === "object" &&
    !Array.isArray(tenant.storefront_config)
      ? (tenant.storefront_config as Record<string, unknown>)
      : {};

  const { data: updated, error } = await service
    .from("tenants")
    .update({
      storefront_config: {
        ...current,
        charge_vat: enabled,
      },
    })
    .eq("id", session.tenantId)
    .select("id")
    .maybeSingle();
  if (error || !updated?.id) return { ok: false };

  // Al apagar IVA, alinear el catálogo para que fichas/reportes no muestren 19 %.
  if (!enabled) {
    await service
      .from("products")
      .update({ has_vat: false, vat_percent: null })
      .eq("tenant_id", session.tenantId);
  }

  revalidatePath("/admin", "layout");
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/products");
  revalidatePath("/admin/ventas/nueva");
  return { ok: true };
}

export async function updatePosPriceFlagAction(
  flag: PosPriceFlag,
  enabled: boolean,
): Promise<{ ok: true } | { ok: false }> {
  const key = POS_PRICE_FLAG_KEYS[flag];
  if (!key) return { ok: false };
  const session = await requireAdminSession();
  if (session.jobRole !== "owner" && !session.isPlatformOperator) {
    return { ok: false };
  }

  let service: ReturnType<typeof createSupabaseServiceClient>;
  try {
    service = createSupabaseServiceClient();
  } catch {
    return { ok: false };
  }

  const { data: tenant } = await service
    .from("tenants")
    .select("storefront_config")
    .eq("id", session.tenantId)
    .maybeSingle();
  if (!tenant) return { ok: false };

  const current =
    tenant.storefront_config &&
    typeof tenant.storefront_config === "object" &&
    !Array.isArray(tenant.storefront_config)
      ? (tenant.storefront_config as Record<string, unknown>)
      : {};

  const { data: updated, error } = await service
    .from("tenants")
    .update({
      storefront_config: {
        ...current,
        [key]: enabled,
      },
    })
    .eq("id", session.tenantId)
    .select("id")
    .maybeSingle();
  if (error || !updated?.id) return { ok: false };

  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/ventas/nueva");
  return { ok: true };
}
