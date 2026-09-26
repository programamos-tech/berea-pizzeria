#!/usr/bin/env node
/**
 * Alta de la cuenta Toro Technology (Diego Toro).
 *   node scripts/create-toro-technology.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const LOGO_SRC = join(root, "public/logo-toro-technology.jpg");
const SLUG = "toro-technology";
const TRADE_NAME = "Toro Technology";
const HOLDER_NAME = "Diego Toro";
const OWNER_EMAIL = "diego.toro@torotechnology.com";
const LOGIN_USERNAME = "diegotoro";

function parseEnvFile(p) {
  const out = {};
  if (!existsSync(p)) return out;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadEnvIntoProcess(p) {
  for (const [k, v] of Object.entries(parseEnvFile(p))) {
    if (!v || /\[SENSITIVE\]/i.test(v)) continue;
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvIntoProcess(join(root, ".env.local"));
loadEnvIntoProcess(join(root, ".env"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!existsSync(LOGO_SRC)) {
  console.error("Falta el logo en", LOGO_SRC);
  process.exit(1);
}

const service = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const password = `ToroTech-${randomBytes(6).toString("base64url")}`;

const { data: existing } = await service
  .from("tenants")
  .select("id, slug")
  .eq("slug", SLUG)
  .maybeSingle();
if (existing?.id) {
  console.error("Ya existe el tenant", SLUG, existing.id);
  process.exit(1);
}

const brand = {
  trade_name: TRADE_NAME,
  legal_name: TRADE_NAME,
  primary_color: "#111111",
};

const { data: tenant, error: tErr } = await service
  .from("tenants")
  .insert({
    slug: SLUG,
    name: TRADE_NAME,
    status: "active",
    kind: "customer",
    account_holder_name: HOLDER_NAME,
    account_holder_email: OWNER_EMAIL,
    custom_domains: [],
    brand,
    storefront_config: { checkout_mode: "transfer" },
  })
  .select("id, slug")
  .single();

if (tErr || !tenant?.id) {
  console.error("No se pudo crear el tenant:", tErr?.message);
  process.exit(1);
}

const tenantId = tenant.id;
let userId = null;

async function rollback(reason) {
  console.error("Rollback:", reason);
  if (userId) await service.auth.admin.deleteUser(userId);
  await service.from("tenants").delete().eq("id", tenantId);
  process.exit(1);
}

const logoBuf = readFileSync(LOGO_SRC);
const objectPath = `tenants/${tenantId}/logo.jpg`;
const { error: upErr } = await service.storage
  .from("product-images")
  .upload(objectPath, logoBuf, {
    contentType: "image/jpeg",
    upsert: true,
  });
if (upErr) {
  await rollback(`logo: ${upErr.message}`);
}

brand.logo_path = `product-images/${objectPath}`;
const { error: brandErr } = await service
  .from("tenants")
  .update({ brand })
  .eq("id", tenantId);
if (brandErr) {
  await rollback(`brand: ${brandErr.message}`);
}

const { data: created, error: cErr } = await service.auth.admin.createUser({
  email: OWNER_EMAIL,
  password,
  email_confirm: true,
  user_metadata: {
    display_name: HOLDER_NAME,
    login_username: LOGIN_USERNAME,
  },
  app_metadata: {
    tenant_id: tenantId,
    tenant_slug: SLUG,
  },
});
if (cErr || !created.user) {
  await rollback(`auth: ${cErr?.message ?? "sin usuario"}`);
}
userId = created.user.id;

const { error: pErr } = await service.from("profiles").insert({
  id: userId,
  role: "admin",
  display_name: HOLDER_NAME,
  login_username: LOGIN_USERNAME,
  public_email: OWNER_EMAIL,
  job_role: "owner",
  permissions: {},
  avatar_variant: "A",
  is_active: true,
  tenant_id: tenantId,
  is_platform_operator: false,
});
if (pErr) {
  await rollback(`profile: ${pErr.message}`);
}

const { data: aleya } = await service
  .from("tenants")
  .select("id")
  .eq("slug", "aleya")
  .maybeSingle();
if (aleya?.id) {
  const { data: concepts } = await service
    .from("store_expense_concepts")
    .select(
      "name, category, default_payment_method, applies_to_gasto, applies_to_egreso, allows_custom_text, special_key, sort_order, is_active, is_system",
    )
    .eq("tenant_id", aleya.id);
  const rows = (concepts ?? []).filter(
    (row) => !String(row.name ?? "").toLowerCase().includes("milagros"),
  );
  if (rows.length > 0) {
    const { error: concErr } = await service.from("store_expense_concepts").insert(
      rows.map((row) => ({ ...row, tenant_id: tenantId })),
    );
    if (concErr) {
      console.warn("Conceptos de gasto no se copiaron:", concErr.message);
    }
  }
}

const { data: branch } = await service
  .from("branches")
  .select("id, name, code")
  .eq("tenant_id", tenantId)
  .maybeSingle();
const { data: caja } = await service
  .from("cash_registers")
  .select("id, name")
  .eq("tenant_id", tenantId)
  .maybeSingle();

const publicLogo = join(root, "public/logo-toro-technology.jpg");
if (!existsSync(publicLogo)) {
  copyFileSync(LOGO_SRC, publicLogo);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      tenantId,
      slug: SLUG,
      holder: HOLDER_NAME,
      store: TRADE_NAME,
      branch: branch ?? null,
      caja: caja ?? null,
      login: {
        email: OWNER_EMAIL,
        username: LOGIN_USERNAME,
        password,
        admin: `https://${SLUG}.productos.bereahouse.com/admin/login`,
      },
    },
    null,
    2,
  ),
);
