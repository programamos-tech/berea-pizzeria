"use server";

import {
  isAccountModuleId,
  parseDisabledAccountModules,
  withModuleDisabled,
} from "@/lib/admin-account-modules";
import { loadAdminPermissions } from "@/lib/load-admin-permissions";
import {
  clearActingTenantCookie,
  setActingTenantCookie,
} from "@/lib/platform-operator-server";
import { isActingTenantId } from "@/lib/platform-operator";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function enterCustomerAccount(formData: FormData) {
  const perm = await loadAdminPermissions();
  if (!perm?.isPlatformOperator) redirect("/admin/login");
  const tenantId = String(formData.get("tenant_id") ?? "").trim();
  if (!isActingTenantId(tenantId)) redirect("/admin/cuentas");

  let service: ReturnType<typeof createSupabaseServiceClient>;
  try {
    service = createSupabaseServiceClient();
  } catch {
    redirect("/admin/cuentas");
  }

  const { data: tenant } = await service
    .from("tenants")
    .select("id")
    .eq("id", tenantId)
    .eq("kind", "customer")
    .in("status", ["active", "trial"])
    .maybeSingle();

  if (!tenant?.id) redirect("/admin/cuentas");

  await setActingTenantCookie(tenant.id as string);
  revalidatePath("/admin", "layout");
  redirect("/admin");
}

export async function leaveCustomerAccount() {
  const perm = await loadAdminPermissions();
  if (!perm?.isPlatformOperator) redirect("/admin");
  await clearActingTenantCookie();
  revalidatePath("/admin", "layout");
  redirect("/admin/cuentas");
}

export async function setTenantAccountModuleAction(formData: FormData) {
  const perm = await loadAdminPermissions();
  if (!perm?.isPlatformOperator) redirect("/admin/login");

  const tenantId = String(formData.get("tenant_id") ?? "").trim();
  const moduleId = String(formData.get("module_id") ?? "").trim();
  const enabled = String(formData.get("enabled") ?? "") === "1";
  const detailHref = `/admin/cuentas/${tenantId}`;

  if (!isActingTenantId(tenantId) || !isAccountModuleId(moduleId)) {
    redirect("/admin/cuentas");
  }

  let service: ReturnType<typeof createSupabaseServiceClient>;
  try {
    service = createSupabaseServiceClient();
  } catch {
    redirect(`${detailHref}?error=modules`);
  }

  const { data: tenant } = await service
    .from("tenants")
    .select("id, disabled_modules")
    .eq("id", tenantId)
    .eq("kind", "customer")
    .maybeSingle();

  if (!tenant?.id) redirect("/admin/cuentas");

  const next = withModuleDisabled(
    parseDisabledAccountModules(tenant.disabled_modules),
    moduleId,
    enabled,
  );

  const { error } = await service
    .from("tenants")
    .update({ disabled_modules: next })
    .eq("id", tenant.id);

  if (error) {
    console.error("[cuentas] disabled_modules:", error.message);
    redirect(`${detailHref}?error=modules`);
  }

  revalidatePath("/admin", "layout");
  revalidatePath(detailHref);
  redirect(detailHref);
}

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function updateCustomerAccountInfo(formData: FormData) {
  const perm = await loadAdminPermissions();
  if (!perm?.isPlatformOperator) redirect("/admin/login");

  const tenantId = String(formData.get("tenant_id") ?? "").trim();
  const detailHref = `/admin/cuentas/${tenantId}`;
  if (!isActingTenantId(tenantId)) redirect("/admin/cuentas");

  const holderName = field(formData, "holder_name");
  const holderEmail = field(formData, "holder_email").toLowerCase();
  const tradeName = field(formData, "trade_name");
  if (!holderName || !tradeName) {
    redirect(`${detailHref}?error=info`);
  }
  if (holderEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(holderEmail)) {
    redirect(`${detailHref}?error=info`);
  }

  let service: ReturnType<typeof createSupabaseServiceClient>;
  try {
    service = createSupabaseServiceClient();
  } catch {
    redirect(`${detailHref}?error=info`);
  }

  const { data: tenant } = await service
    .from("tenants")
    .select("id, account_holder_email, brand")
    .eq("id", tenantId)
    .eq("kind", "customer")
    .maybeSingle();
  if (!tenant?.id) redirect("/admin/cuentas");

  const previousEmail = String(tenant.account_holder_email ?? "")
    .trim()
    .toLowerCase();
  const rawBrand =
    tenant.brand && typeof tenant.brand === "object"
      ? (tenant.brand as Record<string, unknown>)
      : {};
  const brand = {
    ...rawBrand,
    trade_name: tradeName,
    legal_name: field(formData, "legal_name") || undefined,
    tax_nit: field(formData, "tax_nit") || undefined,
    tax_regime: field(formData, "tax_regime") || undefined,
    phone: field(formData, "phone") || undefined,
    whatsapp: field(formData, "whatsapp") || undefined,
    email: field(formData, "business_email") || undefined,
    address: field(formData, "address") || undefined,
    city: field(formData, "city") || undefined,
  };

  const { data: owner } = await service
    .from("profiles")
    .select("id, public_email")
    .eq("tenant_id", tenantId)
    .eq("is_platform_operator", false)
    .eq("job_role", "owner")
    .limit(1)
    .maybeSingle();

  if (owner?.id && holderEmail && holderEmail !== previousEmail) {
    const { error: authError } = await service.auth.admin.updateUserById(
      owner.id as string,
      { email: holderEmail, email_confirm: true },
    );
    if (authError) {
      console.error("[cuentas] email:", authError.message);
      redirect(`${detailHref}?error=email`);
    }
  }

  const { error } = await service
    .from("tenants")
    .update({
      name: tradeName,
      account_holder_name: holderName,
      account_holder_email: holderEmail || null,
      brand,
    })
    .eq("id", tenant.id);

  if (error) {
    console.error("[cuentas] info:", error.message);
    redirect(`${detailHref}?error=info`);
  }

  if (owner?.id) {
    await service
      .from("profiles")
      .update({
        display_name: holderName,
        public_email: holderEmail || null,
      })
      .eq("id", owner.id);
  }

  revalidatePath("/admin/cuentas");
  revalidatePath(detailHref);
  redirect(`${detailHref}?saved=1`);
}
