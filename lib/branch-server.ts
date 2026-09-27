import { cache } from "react";
import { cookies, headers } from "next/headers";
import {
  ACTIVE_BRANCH_COOKIE,
  ACTIVE_BRANCH_COOKIE_MAX_AGE,
  ACTIVE_BRANCH_HEADER,
  isBranchId,
  type BranchContext,
  type BranchRef,
} from "@/lib/branch-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function mapBranch(row: Record<string, unknown>): BranchRef {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    code: String(row.code),
    logoPath: row.logo_path ? String(row.logo_path) : null,
    isDefault: row.is_default === true,
    isActive: row.is_active === true,
  };
}

async function loadBranchContextUncached(
  tenantId: string,
): Promise<BranchContext | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("branches")
    .select("id,tenant_id,name,code,logo_path,is_default,is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[branches] load:", error.message);
    return null;
  }

  const available = (data ?? []).map((row) =>
    mapBranch(row as Record<string, unknown>),
  );
  if (available.length === 0) return null;

  const requested = (await headers()).get(ACTIVE_BRANCH_HEADER)?.trim();
  const active =
    (isBranchId(requested)
      ? available.find((branch) => branch.id === requested)
      : null) ??
    available.find((branch) => branch.isDefault) ??
    available[0]!;

  return { active, available };
}

export const loadBranchContext = cache(loadBranchContextUncached);

function branchCookieOptions() {
  return {
    // The UUID is not an authorization credential. Browser Supabase requests
    // also forward it; RLS independently validates membership.
    httpOnly: false,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACTIVE_BRANCH_COOKIE_MAX_AGE,
  };
}

export async function setActiveBranchCookie(branchId: string): Promise<void> {
  if (!isBranchId(branchId)) throw new Error("Invalid branch id");
  (await cookies()).set(ACTIVE_BRANCH_COOKIE, branchId, branchCookieOptions());
}

export async function clearActiveBranchCookie(): Promise<void> {
  (await cookies()).set(ACTIVE_BRANCH_COOKIE, "", {
    ...branchCookieOptions(),
    maxAge: 0,
  });
}
