/** Visible store name; override with NEXT_PUBLIC_STORE_NAME per fork. */
export const storeBrand =
  process.env.NEXT_PUBLIC_STORE_NAME ?? "Berea Pizzerías";

/**
 * Razón social en facturas / tirilla (si no va en env, coincide con `storeBrand`).
 */
export const storeLegalName =
  process.env.NEXT_PUBLIC_STORE_LEGAL_NAME?.trim() || storeBrand;

/** NIT u otro ID fiscal (solo se muestra en tirilla si está definido). */
export const storeTaxNit = process.env.NEXT_PUBLIC_STORE_NIT?.trim() ?? "";

/**
 * Razón social en factura / tirilla (prioridad sobre `storeLegalName` en ese documento).
 * `NEXT_PUBLIC_INVOICE_LEGAL_NAME` para personalizar sin cambiar el resto del sitio.
 */
export const invoiceLegalName =
  process.env.NEXT_PUBLIC_INVOICE_LEGAL_NAME?.trim() ||
  process.env.NEXT_PUBLIC_STORE_LEGAL_NAME?.trim() ||
  "Berea Pizzerías SAS";

/** NIT en cabecera de factura (prioridad sobre `storeTaxNit` en ese documento). */
export const invoiceTaxNit =
  process.env.NEXT_PUBLIC_INVOICE_NIT?.trim() ||
  process.env.NEXT_PUBLIC_STORE_NIT?.trim() ||
  "901.522.077";

/** Nombre comercial corto en tirilla (“Tienda”, pie de agradecimiento). */
export const invoiceTradeName =
  process.env.NEXT_PUBLIC_INVOICE_TRADE_NAME?.trim() ||
  process.env.NEXT_PUBLIC_STORE_NAME?.trim() ||
  "Berea Pizzerías";

/** Logo en tirilla / factura impresa. */
export const invoiceLogoPath =
  process.env.NEXT_PUBLIC_INVOICE_LOGO?.trim() ||
  process.env.NEXT_PUBLIC_STORE_LOGO?.trim() ||
  "/logo-aleyahso.png";

/** Dirección física en tirilla (línea 1, ej. calle). */
export const invoiceStoreAddress =
  process.env.NEXT_PUBLIC_INVOICE_ADDRESS?.trim() ?? "";

/** Ciudad en tirilla (línea 2). */
export const invoiceStoreCity =
  process.env.NEXT_PUBLIC_INVOICE_CITY?.trim() ?? "";

/** Régimen tributario (texto libre; típico en CO: Responsables de IVA). */
export const storeTaxRegime =
  process.env.NEXT_PUBLIC_STORE_TAX_REGIME?.trim() ||
  "Responsables de IVA";

/**
 * Logo de la tienda en cabecera y pie (`/public`).
 * Por defecto el mismo asset que el admin; `NEXT_PUBLIC_STORE_LOGO` para otro archivo.
 */
export const storeLogoPath =
  process.env.NEXT_PUBLIC_STORE_LOGO?.trim() || "/logo-finala.png";

/**
 * Logo Berea (marca #ed7464 en Pizzerías) en el sidebar.
 * Override: `NEXT_PUBLIC_ADMIN_SIDEBAR_LOGO`.
 */
export const adminSidebarLogoPath =
  process.env.NEXT_PUBLIC_ADMIN_SIDEBAR_LOGO?.trim() ||
  "/logo-berea-productos-v3.png";

/** Nombre del producto / sistema en el backoffice (marca Berea). */
export const adminProductBrand = "Berea Pizzerías";

/**
 * Cuenta SaaS / workspace en el sidebar.
 * Override: `NEXT_PUBLIC_ADMIN_TENANT_NAME` (por defecto “Aleya Shop”).
 */
export const adminTenantBrand =
  process.env.NEXT_PUBLIC_ADMIN_TENANT_NAME?.trim() || "Berea Pizzerías";

/**
 * Avatar de la cuenta tenant (logo Aleya, claro sobre fondo oscuro).
 * Override: `NEXT_PUBLIC_ADMIN_TENANT_LOGO`.
 */
export const adminTenantLogoPath =
  process.env.NEXT_PUBLIC_ADMIN_TENANT_LOGO?.trim() ||
  "/logo-aleyashop-mark.png";

/** Firma Berea House (wordmark transparente). Override: `NEXT_PUBLIC_BEREA_LOGO`. */
export const bereaSignaturePath =
  process.env.NEXT_PUBLIC_BEREA_LOGO?.trim() || "/logo-berea-productos-v3.png";

/**
 * Nombre en el pie © (independiente del nombre corto de marca si usás env de plantilla).
 * Ej.: NEXT_PUBLIC_STORE_COPYRIGHT_NAME
 */
export const storeCopyrightHolder =
  process.env.NEXT_PUBLIC_STORE_COPYRIGHT_NAME ?? "Berea Pizzerías";

/** Línea bajo el nombre (footer, etc.). */
export const storeTagline =
  process.env.NEXT_PUBLIC_STORE_TAGLINE ??
  "Pizzería · pedidos y facturación";

/** Párrafo corto sobre la tienda (footer). */
export const storeShortDescription =
  process.env.NEXT_PUBLIC_STORE_DESCRIPTION ??
  "Sistema Berea Pizzerías para pedidos, caja y facturación. Entorno local de desarrollo.";

/** Teléfono de contacto (footer, cabecera). */
export const storeSupportPhone =
  process.env.NEXT_PUBLIC_STORE_PHONE ?? "+57 320 5848594";

/**
 * Solo dígitos para wa.me (sin +). Puedes fijar NEXT_PUBLIC_WHATSAPP_NUMBER si difiere del teléfono visible.
 */
const whatsappDigits =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") ??
  storeSupportPhone.replace(/\D/g, "");

/** Enlace directo a chat de WhatsApp. */
export const storeWhatsAppUrl: string = whatsappDigits
  ? `https://wa.me/${whatsappDigits}`
  : "#";

/** Texto del anuncio superior (marquee). */
export const storeAnnouncementMessage =
  process.env.NEXT_PUBLIC_STORE_ANNOUNCEMENT ??
  "Berea Pizzerías · entorno local de desarrollo";

/** Mensaje corto del banner de bienvenida de la tienda. */
export const storeWelcomeDiscountMessage =
  process.env.NEXT_PUBLIC_STORE_WELCOME_BANNER ??
  "Bienvenida: 10% OFF en tu primera compra";

/** Código promocional visible en el banner de bienvenida. */
export const storeWelcomeDiscountCode =
  process.env.NEXT_PUBLIC_STORE_WELCOME_CODE ?? "BIENVENIDA10";

/** Email de contacto visible en el footer. */
export const storeSupportEmail =
  process.env.NEXT_PUBLIC_STORE_EMAIL ?? "hola@bereapizzerias.local";

/** Horario de atención (texto libre). */
export const storeSupportHours =
  process.env.NEXT_PUBLIC_STORE_HOURS ?? "Lun. a vie. · 9:00 – 18:00 (Colombia)";

/** Perfil de Instagram de la tienda. */
export const storeInstagramUrl =
  process.env.NEXT_PUBLIC_STORE_INSTAGRAM_URL ??
  "https://www.instagram.com/";

/** Mensaje precargado para abrir WhatsApp. */
export const storeWhatsAppPrefilledText =
  process.env.NEXT_PUBLIC_WHATSAPP_TEXT ??
  "Hola, te escribo desde Berea Pizzerías.";

/**
 * Soporte WhatsApp del backoffice Berea Pizzerías (sidebar).
 * Override: `NEXT_PUBLIC_ADMIN_SUPPORT_WHATSAPP` (solo dígitos o con formato).
 */
const adminSupportWhatsAppDigits =
  process.env.NEXT_PUBLIC_ADMIN_SUPPORT_WHATSAPP?.replace(/\D/g, "") ||
  "573001575829";

export const adminSupportWhatsAppDisplay =
  process.env.NEXT_PUBLIC_ADMIN_SUPPORT_WHATSAPP_LABEL?.trim() ||
  "300 157 5829";

export const adminSupportWhatsAppUrl = `https://wa.me/${adminSupportWhatsAppDigits}`;

export const adminSupportWhatsAppPrefilledText =
  process.env.NEXT_PUBLIC_ADMIN_SUPPORT_WHATSAPP_TEXT?.trim() ||
  "Hola, escribo desde Berea Pizzerías. Necesito ayuda con el panel.";
