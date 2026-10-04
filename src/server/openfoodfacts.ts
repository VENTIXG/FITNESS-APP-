import "server-only";
import { APP_NAME } from "@/lib/config";

export function offEnabled() {
  return process.env.OPENFOODFACTS_ENABLED !== "false";
}

export type OffProduct = { name: string; brand: string | null; barcode: string; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number; sugarG: number | null; sodiumMg: number | null; servingG: number | null };

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && !Number.isNaN(Number(v)) ? Number(v) : null);

/** Looks a barcode up on Open Food Facts (server-side; only the barcode is sent). */
export async function lookupOff(barcode: string): Promise<OffProduct | null | "unavailable"> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,nutriments,serving_quantity`, {
      headers: { "User-Agent": `${APP_NAME}/1.0 (private self-hosted fitness tracker)` },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) return "unavailable";
    const json = (await res.json()) as { status?: number; product?: { product_name?: string; brands?: string; nutriments?: Record<string, unknown>; serving_quantity?: unknown } };
    const p = json.product;
    if (!json.status || !p) return null;
    const nu = p.nutriments ?? {};
    const kcal = n(nu["energy-kcal_100g"]) ?? (n(nu["energy_100g"]) != null ? n(nu["energy_100g"])! / 4.184 : null);
    if (kcal == null || !p.product_name) return null;
    const sodium = n(nu["sodium_100g"]);
    return {
      name: p.product_name.trim().slice(0, 160),
      brand: p.brands?.split(",")[0]?.trim().slice(0, 120) || null,
      barcode,
      calories: Math.min(1000, Math.round(kcal)),
      proteinG: n(nu["proteins_100g"]) ?? 0,
      carbsG: n(nu["carbohydrates_100g"]) ?? 0,
      fatG: n(nu["fat_100g"]) ?? 0,
      fiberG: n(nu["fiber_100g"]) ?? 0,
      sugarG: n(nu["sugars_100g"]),
      sodiumMg: sodium != null ? Math.round(sodium * 1000) : null,
      servingG: n(p.serving_quantity),
    };
  } catch {
    return "unavailable";
  }
}
