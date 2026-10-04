import { z } from "zod";
import {
  DASHBOARD_CARDS,
  REMINDER_KINDS,
  SCORE_COMPONENTS,
  type DashboardCard,
  type ReminderKind,
  type ScoreComponent,
} from "./domain";

/**
 * JSON preference blobs stored on `user_preferences`. Every blob is parsed with
 * its schema on read so older rows gain new defaults without migrations.
 */

export const trainingPrefsSchema = z.object({
  defaultRestSeconds: z.number().int().min(0).max(900).default(120),
  autoStartRest: z.boolean().default(true),
  restSound: z.boolean().default(true),
  restVibrate: z.boolean().default(true),
  effortMetric: z.enum(["rir", "rpe"]).default("rir"),
  defaultRepMin: z.number().int().min(1).max(50).default(8),
  defaultRepMax: z.number().int().min(1).max(100).default(12),
  /** Load increments (kg) used by progression suggestions. */
  incrementUpperKg: z.number().min(0.25).max(20).default(2.5),
  incrementLowerKg: z.number().min(0.25).max(40).default(5),
  incrementIsolationKg: z.number().min(0.25).max(20).default(1),
  /** Smallest loadable step; suggestions are rounded to this. */
  roundingKg: z.number().min(0.1).max(5).default(1.25),
  includeWarmupsInVolume: z.boolean().default(false),
  /** Workouts per week the user plans; used when no program schedule defines it. */
  plannedWorkoutsPerWeek: z.number().int().min(0).max(14).default(4),
});
export type TrainingPrefs = z.infer<typeof trainingPrefsSchema>;

export const mealSlotSchema = z.object({
  id: z.string().min(1).max(40),
  /** null = use the localized default name (breakfast/lunch/...). */
  name: z.string().max(40).nullable(),
});
export type MealSlot = z.infer<typeof mealSlotSchema>;

export const DEFAULT_MEAL_SLOT_LIST: MealSlot[] = [
  { id: "breakfast", name: null },
  { id: "lunch", name: null },
  { id: "dinner", name: null },
  { id: "snacks", name: null },
];

export const nutritionPrefsSchema = z.object({
  mealSlots: z.array(mealSlotSchema).min(1).max(8).default(DEFAULT_MEAL_SLOT_LIST),
  showSugar: z.boolean().default(false),
  showSodium: z.boolean().default(false),
});
export type NutritionPrefs = z.infer<typeof nutritionPrefsSchema>;

export const DEFAULT_DASHBOARD_ORDER: DashboardCard[] = [
  "score",
  "weight",
  "goal",
  "calories",
  "macros",
  "workout",
  "steps",
  "cardio",
  "water",
  "habits",
  "weekly",
  "insights",
];

const isDashboardCard = (v: string): v is DashboardCard => (DASHBOARD_CARDS as readonly string[]).includes(v);
const cardList = z.array(z.string()).transform((list) => list.filter(isDashboardCard));

export const dashboardPrefsSchema = z.object({
  order: cardList.default(DEFAULT_DASHBOARD_ORDER),
  hidden: cardList.default([]),
});
export type DashboardPrefs = z.infer<typeof dashboardPrefsSchema>;

/** Normalizes a stored order: drops unknown cards, appends newly added ones. */
export function resolveDashboardOrder(prefs: DashboardPrefs): DashboardCard[] {
  const seen = new Set<DashboardCard>();
  const order: DashboardCard[] = [];
  for (const card of prefs.order) {
    if (!seen.has(card)) {
      seen.add(card);
      order.push(card);
    }
  }
  for (const card of DEFAULT_DASHBOARD_ORDER) if (!seen.has(card)) order.push(card);
  return order;
}

export const DEFAULT_SCORE_WEIGHTS: Record<ScoreComponent, number> = {
  calories: 3,
  protein: 3,
  steps: 2,
  workout: 2,
  cardio: 1,
  sleep: 2,
  water: 1,
};

export const scoringPrefsSchema = z.object({
  enabled: z.boolean().default(true),
  weights: z
    .partialRecord(z.enum(SCORE_COMPONENTS), z.number().int().min(0).max(5))
    .default(DEFAULT_SCORE_WEIGHTS)
    .transform((w) => ({ ...DEFAULT_SCORE_WEIGHTS, ...w }) as Record<ScoreComponent, number>),
});
export type ScoringPrefs = z.infer<typeof scoringPrefsSchema>;

const reminderSchema = z.object({
  enabled: z.boolean().default(false),
  /** Local time HH:MM */
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("08:00"),
});

export const DEFAULT_REMINDER_TIMES: Record<ReminderKind, string> = {
  weight: "07:30",
  workout: "17:30",
  supplements: "09:00",
  water: "14:00",
  steps: "19:00",
  nutrition: "21:00",
  sleep: "22:30",
};

export const notificationPrefsSchema = z.object({
  /** Master switch — nothing is sent while false. */
  enabled: z.boolean().default(false),
  reminders: z
    .partialRecord(z.enum(REMINDER_KINDS), reminderSchema)
    .default({})
    .transform((r) => {
      const out = {} as Record<ReminderKind, { enabled: boolean; time: string }>;
      for (const kind of REMINDER_KINDS) {
        out[kind] = { enabled: r[kind]?.enabled ?? false, time: r[kind]?.time ?? DEFAULT_REMINDER_TIMES[kind] };
      }
      return out;
    }),
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

export const goalsPrefsSchema = z.object({
  stepGoal: z.number().int().min(0).max(100000).default(10000),
  waterGoalMl: z.number().int().min(0).max(10000).default(2500),
  sleepGoalMinutes: z.number().int().min(0).max(960).default(480),
  cardioMinutesPerWeek: z.number().int().min(0).max(3000).default(150),
});
export type GoalsPrefs = z.infer<typeof goalsPrefsSchema>;

export function parseTrainingPrefs(v: unknown): TrainingPrefs {
  return trainingPrefsSchema.parse(v ?? {});
}
export function parseNutritionPrefs(v: unknown): NutritionPrefs {
  return nutritionPrefsSchema.parse(v ?? {});
}
export function parseDashboardPrefs(v: unknown): DashboardPrefs {
  const r = dashboardPrefsSchema.safeParse(v ?? {});
  return r.success ? r.data : dashboardPrefsSchema.parse({});
}
export function parseScoringPrefs(v: unknown): ScoringPrefs {
  const r = scoringPrefsSchema.safeParse(v ?? {});
  return r.success ? r.data : scoringPrefsSchema.parse({});
}
export function parseNotificationPrefs(v: unknown): NotificationPrefs {
  const r = notificationPrefsSchema.safeParse(v ?? {});
  return r.success ? r.data : notificationPrefsSchema.parse({});
}
export function parseGoalsPrefs(v: unknown): GoalsPrefs {
  const r = goalsPrefsSchema.safeParse(v ?? {});
  return r.success ? r.data : goalsPrefsSchema.parse({});
}
