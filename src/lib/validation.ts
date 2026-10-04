import { z } from "zod";
import { isISODate } from "./dates";

/** Shared Zod building blocks (client forms and server actions use the same rules). */

export const isoDate = z.string().refine(isISODate, "invalid_date");
export const uuid = z.string().uuid();
export const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));
export const requiredName = (max = 120) => z.string().trim().min(1).max(max);
export const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/);

export const weightKg = z.number().finite().min(20).max(400);
export const bodyFatPct = z.number().finite().min(2).max(75);
export const circumferenceCm = z.number().finite().min(5).max(300);

export const nutrientsSchema = z.object({
  calories: z.number().finite().min(0).max(20000),
  proteinG: z.number().finite().min(0).max(2000),
  carbsG: z.number().finite().min(0).max(3000),
  fatG: z.number().finite().min(0).max(1000),
  fiberG: z.number().finite().min(0).max(500),
  sugarG: z.number().finite().min(0).max(2000).nullable().optional(),
  sodiumMg: z.number().finite().min(0).max(100000).nullable().optional(),
});
