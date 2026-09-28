"use server";

import { logAdminActivity } from "@/lib/admin-activity-log";
import {
  clampWholesaleDiscountPercent,
  parseStoreCustomerKind,
} from "@/lib/customer-wholesale-pricing";
import { loadAdminPermissions } from "@/lib/load-admin-permissions";
import {
  verifyInsertedRowInDev,
  verifyRowCountAtLeastInDev,
} from "@/lib/admin-insert-verify";
import { assertActionPermission } from "@/lib/require-admin-permission";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type QuickStoreCustomerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  document_id: string | null;
};

export type CreateQuickStoreCustomerResult =
  | { ok: true; customer: QuickStoreCustomerRow }
  | {
      ok: false;
      code:
        | "auth"
        | "forbidden"
        | "name"
        | "phone"
        | "address"
        | "duplicate_document"
        | "db";
    };

async function customerExistsWithDocumentId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  documentId: string,
): Promise<boolean> {
  const trimmed = documentId.trim();
  if (!trimmed) return false;
  const { data } = await supabase
    .from("customers")
    .select("id")
    .eq("document_id", trimmed)
    .maybeSingle();
  return Boolean(data?.id);
}

/** Alta mínima desde POS (sin redirect); para modal en nueva factura / pedido. */
export async function createQuickStoreCustomer(input: {
  name: string;
  phone: string;
  shipping_address: string;
  document_id?: string;
}): Promise<CreateQuickStoreCustomerResult> {
  const perm = await loadAdminPermissions();
  if (!perm) return { ok: false, code: "auth" };
  if (!perm.permissions.clientes_crear) return { ok: false, code: "forbidden" };

  const supabase = await createSupabaseServerClient();
  const name = String(input.name ?? "").trim();
  const phone = String(input.phone ?? "").trim();
  const shippingAddress = String(input.shipping_address ?? "").trim();
  const documentId = String(input.document_id ?? "").trim();
  if (!name) return { ok: false, code: "name" };
  if (phone.length < 7) return { ok: false, code: "phone" };
  if (shippingAddress.length < 3) return { ok: false, code: "address" };

  if (documentId && (await customerExistsWithDocumentId(supabase, documentId))) {
    return { ok: false, code: "duplicate_document" };
  }

  const { data: cust, error: insertErr } = await supabase
    .from("customers")
    .insert({
      name,
      email: null,
      phone,
      document_id: documentId || null,
      shipping_address: shippingAddress,
      shipping_city: null,
      shipping_postal_code: null,
      source: "manual",
    })
    .select("id,name,email,phone,document_id")
    .single();

  if (insertErr || !cust) return { ok: false, code: "db" };

  const customerId = (cust as { id: string }).id;
  if (!(await verifyInsertedRowInDev(supabase, "customers", customerId))) {
    return { ok: false, code: "db" };
  }

  void logAdminActivity(supabase, {
    actorId: perm.userId,
    actionType: "customer_created",
    entityType: "customer",
    entityId: customerId,
    summary: `Nuevo cliente: ${name}${phone ? ` · ${phone}` : ""}${documentId ? ` · Doc. ${documentId}` : ""}`,
    metadata: {
      source: "pos_quick",
      phone,
      shipping_address: shippingAddress,
      ...(documentId ? { document_id: documentId } : {}),
    },
  });

  return {
    ok: true,
    customer: cust as QuickStoreCustomerRow,
  };
}

function normEmail(v: string): string | null {
  const t = v.trim().toLowerCase();
  return t ? t : null;
}

function customerBillingFieldsFromForm(formData: FormData): {
  document_type: "cc" | "nit";
  requires_electronic_invoice: boolean;
} {
  return {
    document_type:
      String(formData.get("document_type") ?? "").trim() === "nit"
        ? "nit"
        : "cc",
    requires_electronic_invoice:
      String(formData.get("requires_electronic_invoice") ?? "") === "on",
  };
}

function isEmailLike(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

/** Mayorista: NIT (document_id), correo y teléfono obligatorios. */
function assertWholesaleMandatoryFields(
  customerKind: "retail" | "wholesale",
  documentId: string,
  emailRaw: string,
  phone: string,
  redirectOnError: (code: string) => never,
) {
  if (customerKind !== "wholesale") return;
  const nit = documentId.trim();
  const mail = emailRaw.trim();
  const tel = phone.trim();
  if (!nit || !mail || !tel || !isEmailLike(mail)) {
    redirectOnError("wholesale_required");
  }
}

function wholesaleFieldsFromForm(formData: FormData): {
  customer_kind: "retail" | "wholesale";
  wholesale_discount_percent: number;
} {
  const kind = parseStoreCustomerKind(
    String(formData.get("customer_kind") ?? "").trim(),
  );
  const pctRaw = Number(String(formData.get("wholesale_discount_percent") ?? "0"));
  const pct = clampWholesaleDiscountPercent(pctRaw);
  return {
    customer_kind: kind,
    wholesale_discount_percent: kind === "wholesale" ? pct : 0,
  };
}

type AddressPayload = {
  label: string;
  address_line: string;
  reference: string;
};

function parseAdminReturnPath(raw: string): string | null {
  const t = String(raw ?? "").trim();
  if (!t.startsWith("/admin/") || t.includes("://") || t.includes("?") || t.includes("#")) {
    return null;
  }
  return t;
}

export async function createStoreCustomer(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  await assertActionPermission("clientes_crear");

  const returnTo = parseAdminReturnPath(String(formData.get("return_to") ?? ""));
  const redirectNewCustomerError = (code: string): never => {
    if (returnTo) {
      redirect(
        `/admin/customers/new?error=${encodeURIComponent(code)}&return=${encodeURIComponent(returnTo)}`,
      );
    }
    redirect(`/admin/customers/new?error=${code}`);
  };

  const name = String(formData.get("name") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const documentId = String(formData.get("document_id") ?? "").trim();

  let addresses: AddressPayload[] = [];
  try {
    const raw = String(formData.get("addresses_payload") ?? "").trim();
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        redirectNewCustomerError("addresses_invalid");
      }
      addresses = (parsed as unknown[]).map((row) => ({
        label: String((row as AddressPayload).label ?? "Casa").trim() || "Casa",
        address_line: String((row as AddressPayload).address_line ?? "").trim(),
        reference: String((row as AddressPayload).reference ?? "").trim(),
      }));
    }
  } catch {
    redirectNewCustomerError("addresses_invalid");
  }

  const meaningful = addresses.filter(
    (a) => a.address_line.length > 0 || a.reference.length > 0,
  );

  const email = normEmail(emailRaw);
  const { customer_kind, wholesale_discount_percent } =
    wholesaleFieldsFromForm(formData);
  const { document_type, requires_electronic_invoice } =
    customerBillingFieldsFromForm(formData);

  if (!name) redirectNewCustomerError("name");

  assertWholesaleMandatoryFields(
    customer_kind,
    documentId,
    emailRaw,
    phone,
    (code) => redirectNewCustomerError(code),
  );

  if (email) {
    const { data: dup } = await supabase
      .from("customers")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (dup) redirectNewCustomerError("duplicate_email");
  }

  if (documentId && (await customerExistsWithDocumentId(supabase, documentId))) {
    redirectNewCustomerError("duplicate_document");
  }

  const primary = meaningful[0];
  const shippingAddress = primary
    ? [primary.address_line, primary.reference].filter(Boolean).join("\n\n") || null
    : null;

  const { data: cust, error: insertErr } = await supabase
    .from("customers")
    .insert({
      name,
      email,
      phone: phone || null,
      document_id: documentId || null,
      document_type,
      requires_electronic_invoice,
      shipping_address: shippingAddress,
      shipping_city: null,
      shipping_postal_code: null,
      source: "manual",
      customer_kind,
      wholesale_discount_percent,
    })
    .select("id")
    .single();

  if (insertErr || !cust) redirectNewCustomerError("db");

  const customerId = String(cust!.id);

  if (meaningful.length > 0) {
    const rows = meaningful.map((a, i) => ({
      customer_id: customerId,
      label: a.label,
      address_line: a.address_line,
      reference: a.reference,
      sort_order: i,
    }));

    const { error: addrErr } = await supabase.from("customer_addresses").insert(rows);

    if (addrErr) {
      await supabase.from("customers").delete().eq("id", customerId);
      redirectNewCustomerError("db");
    }
  }

  if (!(await verifyInsertedRowInDev(supabase, "customers", customerId))) {
    redirectNewCustomerError("db");
  }
  if (meaningful.length > 0) {
    const addressesOk = await verifyRowCountAtLeastInDev(
      supabase,
      "customer_addresses",
      { column: "customer_id", value: customerId },
      meaningful.length,
    );
    if (!addressesOk) {
      await supabase.from("customer_addresses").delete().eq("customer_id", customerId);
      await supabase.from("customers").delete().eq("id", customerId);
      redirectNewCustomerError("db");
    }
  }

  await logAdminActivity(supabase, {
    actorId: user.id,
    actionType: "customer_created",
    entityType: "customer",
    entityId: customerId,
    summary: `Nuevo cliente: ${name}`,
    metadata: {
      source: "form",
      customer_kind,
      wholesale_discount_percent,
      document_type,
      requires_electronic_invoice,
      ...(documentId ? { document_id: documentId } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
    },
  });
  revalidatePath("/admin/actividades");
  revalidatePath("/admin/customers");
  revalidatePath("/admin/ventas/nueva");
  if (returnTo) {
    redirect(`${returnTo}?customer=${encodeURIComponent(customerId)}`);
  }
  redirect("/admin/customers");
}

export async function updateStoreCustomer(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  await assertActionPermission("clientes_editar");

  const customerId = String(formData.get("customer_id") ?? "").trim();
  if (!customerId) redirect("/admin/customers");

  const name = String(formData.get("name") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const documentId = String(formData.get("document_id") ?? "").trim();

  let addresses: AddressPayload[] = [];
  try {
    const raw = String(formData.get("addresses_payload") ?? "").trim();
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        redirect(`/admin/customers/${customerId}/edit?error=addresses_invalid`);
      }
      addresses = parsed.map((row) => ({
        label: String((row as AddressPayload).label ?? "Casa").trim() || "Casa",
        address_line: String((row as AddressPayload).address_line ?? "").trim(),
        reference: String((row as AddressPayload).reference ?? "").trim(),
      }));
    }
  } catch {
    redirect(`/admin/customers/${customerId}/edit?error=addresses_invalid`);
  }

  const meaningful = addresses.filter(
    (a) => a.address_line.length > 0 || a.reference.length > 0,
  );

  const email = normEmail(emailRaw);
  const { customer_kind, wholesale_discount_percent } =
    wholesaleFieldsFromForm(formData);
  const { document_type, requires_electronic_invoice } =
    customerBillingFieldsFromForm(formData);

  if (!name) {
    redirect(`/admin/customers/${customerId}/edit?error=name`);
  }

  assertWholesaleMandatoryFields(
    customer_kind,
    documentId,
    emailRaw,
    phone,
    (code) => redirect(`/admin/customers/${customerId}/edit?error=${code}`),
  );

  if (email) {
    const { data: dup } = await supabase
      .from("customers")
      .select("id")
      .eq("email", email)
      .neq("id", customerId)
      .maybeSingle();
    if (dup) {
      redirect(`/admin/customers/${customerId}/edit?error=duplicate_email`);
    }
  }

  const primary = meaningful[0];
  const shippingAddress = primary
    ? [primary.address_line, primary.reference].filter(Boolean).join("\n\n") || null
    : null;

  const { data: updatedRows, error: upErr } = await supabase
    .from("customers")
    .update({
      name,
      email,
      phone: phone || null,
      document_id: documentId || null,
      document_type,
      requires_electronic_invoice,
      shipping_address: shippingAddress,
      customer_kind,
      wholesale_discount_percent,
    })
    .eq("id", customerId)
    .select("id");

  if (upErr || !updatedRows?.length) {
    redirect(`/admin/customers/${customerId}/edit?error=db`);
  }

  const { error: delErr } = await supabase
    .from("customer_addresses")
    .delete()
    .eq("customer_id", customerId);

  if (delErr) {
    redirect(`/admin/customers/${customerId}/edit?error=db`);
  }

  if (meaningful.length > 0) {
    const rows = meaningful.map((a, i) => ({
      customer_id: customerId,
      label: a.label,
      address_line: a.address_line,
      reference: a.reference,
      sort_order: i,
    }));

    const { error: addrErr } = await supabase.from("customer_addresses").insert(rows);

    if (addrErr) {
      redirect(`/admin/customers/${customerId}/edit?error=db`);
    }
  }

  await logAdminActivity(supabase, {
    actorId: user.id,
    actionType: "customer_updated",
    entityType: "customer",
    entityId: customerId,
    summary: `Cliente actualizado: ${name}`,
    metadata: {
      customer_kind,
      wholesale_discount_percent,
      document_type,
      requires_electronic_invoice,
      ...(documentId ? { document_id: documentId } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
    },
  });
  revalidatePath("/admin/actividades");
  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${customerId}`);
  redirect(`/admin/customers/${customerId}`);
}

export async function deleteCustomerById(customerId: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  await assertActionPermission("clientes_editar");

  const id = customerId.trim();
  if (!id) redirect("/admin/customers");

  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) {
    redirect(`/admin/customers/${id}?error=delete`);
  }

  revalidatePath("/admin/customers");
  redirect("/admin/customers");
}

export async function deleteCustomerAction(formData: FormData) {
  await deleteCustomerById(String(formData.get("customer_id") ?? ""));
}
