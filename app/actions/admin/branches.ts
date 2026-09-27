"use server";

import { branchSafeAdminPath, isBranchId } from "@/lib/branch-context";
import {
  clearActiveBranchCookie,
  setActiveBranchCookie,
} from "@/lib/branch-server";
import {
  requireAdminPermission,
  requireAdminSession,
} from "@/lib/require-admin-permission";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";

const BRANCH_LOGO_MAX_BYTES = 3 * 1024 * 1024;
const BRANCH_LOGO_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

type BranchLogoInput =
  | { status: "none" }
  | { status: "valid"; file: Blob; extension: string }
  | { status: "invalid" };

function readBranchLogo(formData: FormData): BranchLogoInput {
  const raw = formData.get("logo");
  if (!(raw instanceof Blob) || raw.size <= 0) return { status: "none" };
  const extension = BRANCH_LOGO_EXTENSIONS[raw.type];
  if (!extension || raw.size > BRANCH_LOGO_MAX_BYTES) {
    return { status: "invalid" };
  }
  return { status: "valid", file: raw, extension };
}

async function uploadBranchLogo(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tenantId: string,
  branchId: string,
  input: Extract<BranchLogoInput, { status: "valid" }>,
): Promise<string | null> {
  const objectPath = `branches/${tenantId}/${branchId}/${randomUUID()}.${input.extension}`;
  const { error } = await supabase.storage
    .from("product-images")
    .upload(objectPath, Buffer.from(await input.file.arrayBuffer()), {
      contentType: input.file.type,
      upsert: false,
    });
  return error ? null : `product-images/${objectPath}`;
}

async function removeBranchLogoObject(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  logoPath: string | null | undefined,
) {
  const prefix = "product-images/branches/";
  if (!logoPath?.startsWith(prefix)) return;
  await supabase.storage
    .from("product-images")
    .remove([logoPath.slice("product-images/".length)]);
}

function safeAdminReturnTo(raw: FormDataEntryValue | null): string {
  const path = String(raw ?? "").trim();
  return path.startsWith("/admin") && !path.startsWith("//") ? path : "/admin";
}

function branchCode(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function switchBranchAction(formData: FormData) {
  const perm = await requireAdminSession();
  const id = String(formData.get("branch_id") ?? "").trim();
  const returnTo = branchSafeAdminPath(
    safeAdminReturnTo(formData.get("return_to")),
  );
  if (!isBranchId(id)) redirect(`${returnTo}?branch=invalid`);

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("branches")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", perm.tenantId)
    .eq("is_active", true)
    .maybeSingle();
  if (!data?.id) redirect(`${returnTo}?branch=forbidden`);

  await setActiveBranchCookie(id);
  revalidatePath("/admin", "layout");
  redirect(returnTo);
}

export async function resetBranchAction(formData: FormData) {
  await requireAdminSession();
  await clearActiveBranchCookie();
  revalidatePath("/admin", "layout");
  redirect(safeAdminReturnTo(formData.get("return_to")));
}

export async function createBranchAction(formData: FormData) {
  const perm = await requireAdminPermission("sucursales_gestionar");
  const name = String(formData.get("name") ?? "").trim();
  const code = branchCode(String(formData.get("code") ?? "") || name);
  const logo = readBranchLogo(formData);
  if (!name || !code) redirect("/admin/sucursales/nuevo?error=validation");
  if (logo.status === "invalid") {
    redirect("/admin/sucursales/nuevo?error=logo");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("branches")
    .insert({ tenant_id: perm.tenantId, name, code })
    .select("id")
    .single();
  if (error || !data?.id) {
    const reason = error?.code === "23505" ? "duplicate" : "db";
    redirect(`/admin/sucursales/nuevo?error=${reason}`);
  }

  if (logo.status === "valid") {
    const logoPath = await uploadBranchLogo(
      supabase,
      perm.tenantId,
      String(data.id),
      logo,
    );
    if (!logoPath) {
      await supabase.from("branches").delete().eq("id", data.id);
      redirect("/admin/sucursales/nuevo?error=logo_upload");
    }
    const { error: logoError } = await supabase
      .from("branches")
      .update({ logo_path: logoPath })
      .eq("id", data.id)
      .eq("tenant_id", perm.tenantId);
    if (logoError) {
      await removeBranchLogoObject(supabase, logoPath);
      await supabase.from("branches").delete().eq("id", data.id);
      redirect("/admin/sucursales/nuevo?error=logo_upload");
    }
  }

  revalidatePath("/admin/sucursales");
  redirect("/admin/sucursales?created=1");
}

export async function updateBranchAction(formData: FormData) {
  const perm = await requireAdminPermission("sucursales_gestionar");
  const id = String(formData.get("branch_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const code = branchCode(String(formData.get("code") ?? "") || name);
  const isActive = formData.getAll("is_active").some((v) => v === "true");
  const makeDefault = formData.getAll("is_default").some((v) => v === "true");
  const removeLogo = formData.get("remove_logo") === "true";
  const logo = readBranchLogo(formData);
  if (!isBranchId(id) || !name || !code) {
    redirect(`/admin/sucursales/${id}/edit?error=validation`);
  }
  if (logo.status === "invalid") {
    redirect(`/admin/sucursales/${id}/edit?error=logo`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("branches")
    .select("id,is_default,logo_path")
    .eq("id", id)
    .eq("tenant_id", perm.tenantId)
    .maybeSingle();
  if (
    !existing?.id ||
    (existing.is_default && (!isActive || !makeDefault))
  ) {
    redirect(`/admin/sucursales/${id}/edit?error=default_active`);
  }

  const { error } = await supabase.rpc("update_branch_settings", {
    p_branch_id: id,
    p_name: name,
    p_code: code,
    p_is_active: isActive,
    p_make_default: makeDefault,
  });
  if (error) {
    const reason = error.code === "23505" ? "duplicate" : "db";
    redirect(`/admin/sucursales/${id}/edit?error=${reason}`);
  }

  let nextLogoPath: string | null | undefined;
  if (logo.status === "valid") {
    nextLogoPath = await uploadBranchLogo(
      supabase,
      perm.tenantId,
      id,
      logo,
    );
    if (!nextLogoPath) {
      redirect(`/admin/sucursales/${id}/edit?error=logo_upload`);
    }
  } else if (removeLogo) {
    nextLogoPath = null;
  }

  if (nextLogoPath !== undefined) {
    const { error: logoError } = await supabase
      .from("branches")
      .update({ logo_path: nextLogoPath })
      .eq("id", id)
      .eq("tenant_id", perm.tenantId);
    if (logoError) {
      if (nextLogoPath) {
        await removeBranchLogoObject(supabase, nextLogoPath);
      }
      redirect(`/admin/sucursales/${id}/edit?error=logo_upload`);
    }
    await removeBranchLogoObject(
      supabase,
      String(existing.logo_path ?? "") || null,
    );
  }

  revalidatePath("/admin", "layout");
  revalidatePath("/admin/sucursales");
  redirect("/admin/sucursales?updated=1");
}
