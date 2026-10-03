import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { withTimeout } from "@/lib/async-timeout";
import { hasSupabaseAuthCookie } from "@/lib/supabase-auth-cookie";
import {
  ACTIVE_BRANCH_COOKIE,
  ACTIVE_BRANCH_HEADER,
  isBranchId,
} from "@/lib/branch-context";
import {
  ACTING_TENANT_COOKIE,
  ACTING_TENANT_HEADER,
  isActingTenantId,
} from "@/lib/platform-operator";
import {
  canonicalPlatformUrl,
  firstHostname,
  PLATFORM_PRODUCT_HOST,
  publicHostname,
  resolveTenantFromHost,
  TENANT_KIND_HEADER,
  TENANT_SLUG_HEADER,
} from "@/lib/tenancy";
import { isAdminPathInMaintenance } from "@/lib/admin-nav-maintenance";

const MIDDLEWARE_AUTH_TIMEOUT_MS = 8_000;

const cuentaPublicPaths = new Set(["/cuenta/entrar", "/cuenta/registro"]);

const PUBLIC_STORE_STATIC = new Set([
  "/terminos",
  "/cookies",
  "/privacidad",
  "/quien-soy",
]);

/** Catálogo y páginas de tienda sin auth en middleware (header/cuenta cargan sesión si hace falta). */
function isPublicStorePath(path: string): boolean {
  if (path === "/") return true;
  if (path === "/products" || path.startsWith("/products/")) return true;
  if (path === "/kits" || path.startsWith("/kits/")) return true;
  if (path === "/favoritos" || path === "/cart") return true;
  if (path === "/checkout" || path.startsWith("/checkout/")) return true;
  if (path === "/pedido") return true;
  if (PUBLIC_STORE_STATIC.has(path)) return true;
  if (path.startsWith("/api/store/")) return true;
  return false;
}

/** Rutas sin getUser en edge (menos latencia / evita cuelgues de Auth). */
function skipsMiddlewareAuth(path: string): boolean {
  return (
    path === "/empezar" ||
    path.startsWith("/empezar/") ||
    path.startsWith("/api/products/") ||
    path.startsWith("/api/webhooks/") ||
    // Auth en requireAdminApiSession (getSession local), no en edge.
    path.startsWith("/api/admin/") ||
    path === "/icon.png" ||
    path === "/icon" ||
    path.startsWith("/icon?") ||
    path === "/apple-icon" ||
    path.startsWith("/apple-icon") ||
    path === "/favicon.ico" ||
    path === "/manifest.webmanifest" ||
    path === "/admin/manifest.webmanifest" ||
    isPublicStorePath(path)
  );
}

function isCuentaPath(path: string) {
  return path === "/cuenta" || path.startsWith("/cuenta/");
}

function isAdminActingPath(path: string): boolean {
  return path.startsWith("/admin") || path.startsWith("/api/admin");
}

/** Attach tenant host resolution for downstream RSC / route handlers. */
function withTenantHeaders(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  const resolved = resolveTenantFromHost(
    publicHostname(request.headers, request.nextUrl.hostname),
  );
  if (resolved.slug) {
    response.headers.set(TENANT_SLUG_HEADER, resolved.slug);
    request.headers.set(TENANT_SLUG_HEADER, resolved.slug);
  }
  response.headers.set(TENANT_KIND_HEADER, resolved.kind);
  request.headers.set(TENANT_KIND_HEADER, resolved.kind);

  if (isAdminActingPath(request.nextUrl.pathname)) {
    const acting = request.cookies.get(ACTING_TENANT_COOKIE)?.value?.trim();
    if (isActingTenantId(acting)) {
      response.headers.set(ACTING_TENANT_HEADER, acting);
      request.headers.set(ACTING_TENANT_HEADER, acting);
    }
    const branch = request.cookies.get(ACTIVE_BRANCH_COOKIE)?.value?.trim();
    if (isBranchId(branch)) {
      response.headers.set(ACTIVE_BRANCH_HEADER, branch);
      request.headers.set(ACTIVE_BRANCH_HEADER, branch);
    }
  }
  return response;
}

function nextWithTenant(request: NextRequest): NextResponse {
  return withTenantHeaders(request, NextResponse.next({ request }));
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const search = request.nextUrl.search;
  const host = publicHostname(request.headers, request.nextUrl.hostname);
  const nextHost = firstHostname(request.nextUrl.hostname);
  const alreadyOnPlatform =
    host === PLATFORM_PRODUCT_HOST || nextHost === PLATFORM_PRODUCT_HOST;
  const hostKind = resolveTenantFromHost(
    alreadyOnPlatform ? PLATFORM_PRODUCT_HOST : host,
  ).kind;

  // www del host de plataforma → canónico (sin www).
  // No forzar redirect de *.vercel.app: este deploy (Liaco) se sirve en
  // berea-pizzerias.vercel.app con DEFAULT_TENANT_SLUG hasta tener DNS propio.
  if (!alreadyOnPlatform && host === `www.${PLATFORM_PRODUCT_HOST}`) {
    const destPath = path === "/" ? "/empezar" : path;
    return NextResponse.redirect(canonicalPlatformUrl(destPath, search), 307);
  }

  if (hostKind === "unknown" && isPublicStorePath(path)) {
    return NextResponse.redirect(canonicalPlatformUrl("/empezar", search), 307);
  }

  // productos.bereahouse.com = entrada SaaS (onboarding), no la tienda Aleya/Milagros.
  if (hostKind === "platform") {
    if (path === "/") {
      const destination = request.nextUrl.clone();
      destination.pathname = "/empezar";
      return withTenantHeaders(
        request,
        NextResponse.rewrite(destination, { request }),
      );
    }
    const platformOk =
      path === "/empezar" ||
      path.startsWith("/empezar/") ||
      path.startsWith("/admin") ||
      path.startsWith("/api/") ||
      path === "/icon.png" ||
      path === "/icon" ||
      path.startsWith("/icon?") ||
      path === "/favicon.ico" ||
      path === "/apple-icon" ||
      path.startsWith("/apple-icon") ||
      path === "/manifest.webmanifest" ||
      path === "/admin/manifest.webmanifest";
    if (!platformOk) {
      return withTenantHeaders(
        request,
        NextResponse.redirect(canonicalPlatformUrl("/empezar", search), 307),
      );
    }
  }

  if (skipsMiddlewareAuth(path)) {
    return nextWithTenant(request);
  }

  // Admin (excepto login): solo cookie. El layout valida sesión/perfil.
  // Evita getUser en cada navegación (POS, ventas, etc.) — fuente típica de cuelgues.
  if (path.startsWith("/admin") && !path.startsWith("/admin/login")) {
    if (!hasSupabaseAuthCookie(request)) {
      return withTenantHeaders(
        request,
        NextResponse.redirect(new URL("/admin/login", request.url)),
      );
    }
    if (isAdminPathInMaintenance(path)) {
      return withTenantHeaders(
        request,
        NextResponse.redirect(new URL("/admin", request.url)),
      );
    }
    return nextWithTenant(request);
  }

  let response = nextWithTenant(request);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  let user: User | null = null;
  let supabase: ReturnType<typeof createServerClient> | null = null;

  if (supabaseUrl && supabaseAnonKey) {
    try {
      supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            response = nextWithTenant(request);
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      });

      const authResult = (await withTimeout(
        supabase.auth.getUser(),
        MIDDLEWARE_AUTH_TIMEOUT_MS,
      )) as Awaited<ReturnType<typeof supabase.auth.getUser>> | null;
      if (!authResult) {
        console.error("[middleware] auth.getUser: timeout");
      } else if (authResult.error) {
        console.error("[middleware] auth.getUser:", authResult.error.message);
      } else {
        user = authResult.data.user ?? null;
      }
    } catch (e) {
      console.error("[middleware] Supabase client / getUser failed:", e);
      supabase = null;
      user = null;
    }
  } else {
    console.error(
      "[middleware] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Define them in Vercel → Settings → Environment Variables (all environments) and redeploy.",
    );
  }

  if (isCuentaPath(path)) {
    const { data: profile } =
      user && supabase
        ? await supabase
            .from("profiles")
            .select("id")
            .eq("id", user.id)
            .maybeSingle()
        : { data: null };

    if (user && profile && cuentaPublicPaths.has(path)) {
      return withTenantHeaders(
        request,
        NextResponse.redirect(new URL("/admin", request.url)),
      );
    }

    if (!cuentaPublicPaths.has(path) && !user) {
      const next = new URL("/cuenta/entrar", request.url);
      next.searchParams.set("next", path + request.nextUrl.search);
      return withTenantHeaders(request, NextResponse.redirect(next));
    }

    if (cuentaPublicPaths.has(path) && user && !profile) {
      return withTenantHeaders(
        request,
        NextResponse.redirect(new URL("/cuenta", request.url)),
      );
    }
  }

  if (path.startsWith("/admin/login")) {
    if (user && supabase) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, is_platform_operator")
        .eq("id", user.id)
        .maybeSingle();
      if (profile) {
        const dest = profile.is_platform_operator
          ? "/admin/cuentas"
          : "/admin";
        return withTenantHeaders(
          request,
          NextResponse.redirect(new URL(dest, request.url)),
        );
      }
      const hasNoProfileError =
        request.nextUrl.searchParams.get("error") === "no_profile";
      if (!hasNoProfileError) {
        const next = new URL("/admin/login", request.url);
        next.searchParams.set("error", "no_profile");
        next.searchParams.set("uid", user.id);
        if (user.email) next.searchParams.set("email", user.email);
        return withTenantHeaders(request, NextResponse.redirect(next));
      }
    }
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
