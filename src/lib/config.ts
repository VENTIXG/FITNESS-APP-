/**
 * Global, client-safe app configuration.
 * Rename the product by setting NEXT_PUBLIC_APP_NAME — every UI string,
 * the PWA manifest and page titles read from here.
 */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "FORGE";
export const APP_SHORT_NAME = process.env.NEXT_PUBLIC_APP_SHORT_NAME?.trim() || APP_NAME;
export const APP_DESCRIPTION = "Private fitness operating system";

export const SESSION_COOKIE = "forge_session";
export const LOCALE_COOKIE = "forge_locale";

/** Energy content assumed per kg of body-weight change (mixed tissue). */
export const KCAL_PER_KG = 7700;
