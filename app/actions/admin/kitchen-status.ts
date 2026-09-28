"use server";

import {
  isKitchenStatus,
  type KitchenStatus,
} from "@/lib/kitchen-status";
import { loadAdminPermissions } from "@/lib/load-admin-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updatePedidoKitchenStatus(
  orderId: string,
  kitchenStatus: string,
): Promise<
  | { ok: true; kitchenStatus: KitchenStatus }
  | { ok: false; error: "auth" | "forbidden" | "invalid" | "db" | "not_pedido" }
> {
  const id = String(orderId ?? "").trim();
  const next = String(kitchenStatus ?? "").trim();
  if (!id || !isKitchenStatus(next)) {
    return { ok: false, error: "invalid" };
  }

  const perm = await loadAdminPermissions();
  if (!perm) return { ok: false, error: "auth" };
  if (!perm.permissions.ventas_crear && !perm.permissions.ventas_ver) {
    return { ok: false, error: "forbidden" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id,status,wompi_reference")
    .eq("id", id)
    .maybeSingle();

  if (!order) return { ok: false, error: "db" };
  const ref =
    order.wompi_reference != null ? String(order.wompi_reference) : "";
  if (!ref.startsWith("POS:pedido:")) {
    return { ok: false, error: "not_pedido" };
  }
  if (String(order.status) === "cancelled") {
    return { ok: false, error: "invalid" };
  }

  const { error } = await supabase
    .from("orders")
    .update({ kitchen_status: next })
    .eq("id", id);

  if (error) return { ok: false, error: "db" };

  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/ventas");
  revalidatePath("/admin/orders");

  return { ok: true, kitchenStatus: next };
}
