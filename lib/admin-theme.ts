/**
 * Tema del backoffice — acento Berea Pizzerías (#ed7464), chrome en neutros.
 *
 * Brand coral: #ed7464
 * Sidebar: charcoal / near-black (contrasta con el área de trabajo clara).
 */
export const ADMIN_CORAL = "#ed7464" as const;
export const ADMIN_CORAL_HOVER = "#e05f4e" as const;
export const ADMIN_CORAL_DEEP = "#c44a3c" as const;
export const ADMIN_CORAL_SOFT = "#f5a89e" as const;
export const ADMIN_CORAL_MIST = "#fdf2f0" as const;

/** Ganancia / OK — verde fresco que convive con el coral de marca. */
export const ADMIN_PROFIT = "#2a9a7c" as const;
export const ADMIN_PROFIT_DARK = "#5dceb0" as const;

/** Pérdida / negativo — rojo suave (distinto del coral de marca). */
export const ADMIN_LOSS = "#c4565c" as const;
export const ADMIN_LOSS_DARK = "#e8959a" as const;

/**
 * Fondo del sidebar (`--admin-sidebar-bg`): carbón / near-black.
 * Contrasta con el workspace claro; acentos en coral de marca.
 */
export const ADMIN_SIDEBAR_BG = "#141414" as const;

/** Sidebar cuando el admin está en modo oscuro (un tono más profundo). */
export const ADMIN_SIDEBAR_BG_DARK = "#0a0a0a" as const;

/** Paneles suaves (cuenta, direcciones) — blanco, alineado al canvas. */
export const STORE_CHROME_BG = "#ffffff" as const;

/**
 * Logo Berea House (teal, fondo transparente) — legible en sidebar claro y oscuro.
 */
export const ADMIN_BRAND_LOGO_ON_SIDEBAR_CLASS = "";

/**
 * Firma / wordmark Berea sobre sidebar oscuro (logo medio-oscuro → claro).
 */
export const ADMIN_BEREA_SIGNATURE_ON_SIDEBAR_CLASS =
  "brightness-0 invert opacity-90";

/** Tamaño del wordmark Berea House. */
export const ADMIN_BEREA_MARK_IMG_CLASS =
  "block h-8 w-auto max-w-[9.5rem] object-contain object-center sm:h-9 sm:max-w-[10.5rem]";

/** Logo producto Berea House en cabecera del sidebar. */
export const ADMIN_SIDEBAR_PRODUCT_LOGO_CLASS =
  "block h-auto w-full max-w-[6.75rem] object-contain object-center sm:max-w-[7.25rem]";
