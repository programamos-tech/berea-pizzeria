import { NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-api";

type PosShipOption =
  | { kind: "pickup"; id: "pickup"; label: string; detail: string }
  | {
      kind: "address";
      id: string;
      label: string;
      detail: string;
      reference?: string | null;
    };

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminApiSession();
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  const customerId = id?.trim();
  if (!customerId) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }

  const { supabase } = gate;

  const [customerRes, addressesRes] = await Promise.all([
    supabase
      .from("customers")
      .select(
        "id,name,email,phone,document_id,shipping_address,shipping_reference,customer_kind,wholesale_discount_percent",
      )
      .eq("id", customerId)
      .maybeSingle(),
    supabase
      .from("customer_addresses")
      .select("id,label,address_line,reference,sort_order")
      .eq("customer_id", customerId)
      .order("sort_order", { ascending: true }),
  ]);

  if (customerRes.error) {
    return NextResponse.json({ error: customerRes.error.message }, { status: 500 });
  }
  if (!customerRes.data) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const customer = customerRes.data as {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    document_id: string | null;
    shipping_address: string | null;
    shipping_reference?: string | null;
    customer_kind: string | null;
    wholesale_discount_percent: number | null;
  };
  const rows = addressesRes.data ?? [];

  const shipOptions: PosShipOption[] = [
    {
      kind: "pickup",
      id: "pickup",
      label: "Retiro en tienda",
      detail: "El cliente recoge en sucursal.",
    },
  ];

  for (const r of rows) {
    const line = [r.address_line, r.reference].filter(Boolean).join(" · ");
    shipOptions.push({
      kind: "address",
      id: r.id as string,
      label: String(r.label ?? "Dirección"),
      detail: line || "Sin detalle",
      reference: r.reference != null ? String(r.reference).trim() || null : null,
    });
  }

  const ship = customer.shipping_address?.trim();
  const shipRef =
    customer.shipping_reference != null
      ? String(customer.shipping_reference).trim()
      : "";
  if (rows.length === 0 && ship) {
    const detail = [ship, shipRef].filter(Boolean).join(" · ");
    shipOptions.push({
      kind: "address",
      id: "primary-shipping",
      label: "Principal",
      detail,
      reference: shipRef || null,
    });
  }

  return NextResponse.json(
    { customer, shipOptions },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
