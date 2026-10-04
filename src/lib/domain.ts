/**
 * Shared domain enums. Used by the database schema (as TS-level enums on text
 * columns), Zod validation, and the UI. Keep values stable — they are stored.
 */

export const LOCALES = ["en", "el"] as const;
export type Locale = (typeof LOCALES)[number];

export const UNIT_SYSTEMS = ["metric", "imperial"] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

export const THEMES = ["system", "dark", "light"] as const;
export type ThemePreference = (typeof THEMES)[number];

export const SEXES = ["male", "female"] as const;
export type Sex = (typeof SEXES)[number];

export const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active", "very_active"] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const PRIMARY_GOALS = ["lose_fat", "maintain", "build_muscle", "performance", "other"] as const;
export type PrimaryGoal = (typeof PRIMARY_GOALS)[number];

/** Where a measurement came from. Manual and imported data are always kept distinguishable. */
export const DATA_SOURCES = ["manual", "apple_health", "health_connect", "import", "api"] as const;
export type DataSource = (typeof DATA_SOURCES)[number];
export const IMPORTED_SOURCES: readonly DataSource[] = ["apple_health", "health_connect", "import", "api"];

export const GOAL_STATUSES = ["active", "completed", "archived"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const BODY_FAT_METHODS = ["bia_scale", "dexa", "calipers", "navy", "visual", "other"] as const;
export type BodyFatMethod = (typeof BODY_FAT_METHODS)[number];

export const MEASUREMENT_SITES = [
  "waist",
  "chest",
  "neck",
  "shoulders",
  "leftArm",
  "rightArm",
  "hips",
  "leftThigh",
  "rightThigh",
  "calf",
] as const;
export type MeasurementSite = (typeof MEASUREMENT_SITES)[number];

export const PHOTO_POSES = ["front", "side", "back", "other"] as const;
export type PhotoPose = (typeof PHOTO_POSES)[number];

export const DEFAULT_MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snacks"] as const;
export type DefaultMealSlot = (typeof DEFAULT_MEAL_SLOTS)[number];

export const BASE_UNITS = ["g", "ml"] as const;
export type BaseUnit = (typeof BASE_UNITS)[number];

export const FOOD_SOURCES = ["custom", "builtin", "openfoodfacts", "import"] as const;
export type FoodSource = (typeof FOOD_SOURCES)[number];

export const MUSCLE_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "abs",
  "forearms",
  "other",
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = ["barbell", "dumbbell", "machine", "cable", "bodyweight", "smith_machine", "other"] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const EXERCISE_CATEGORIES = ["compound", "isolation"] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

/** How a set is recorded for this exercise. */
export const TRACKING_TYPES = ["weight_reps", "bodyweight_reps", "duration", "distance"] as const;
export type TrackingType = (typeof TRACKING_TYPES)[number];

export const SET_TYPES = ["normal", "warmup", "drop", "failure"] as const;
export type SetType = (typeof SET_TYPES)[number];

export const WORKOUT_STATUSES = ["in_progress", "completed"] as const;
export type WorkoutStatus = (typeof WORKOUT_STATUSES)[number];

export const SCHEDULE_TYPES = ["rotation", "weekly"] as const;
export type ScheduleType = (typeof SCHEDULE_TYPES)[number];

export const PR_TYPES = ["e1rm", "weight", "rep_at_weight", "set_volume", "session_volume", "reps"] as const;
export type PrType = (typeof PR_TYPES)[number];

export const CARDIO_ACTIVITIES = [
  "walking",
  "running",
  "treadmill",
  "cycling",
  "stationary_bike",
  "stairmaster",
  "elliptical",
  "swimming",
  "rowing",
  "hiking",
  "other",
] as const;
export type CardioActivity = (typeof CARDIO_ACTIVITIES)[number];

export const SUPPLEMENT_SCHEDULES = ["daily", "specific_days", "as_needed"] as const;
export type SupplementSchedule = (typeof SUPPLEMENT_SCHEDULES)[number];

export const SUPPLEMENT_TIMINGS = [
  "morning",
  "midday",
  "evening",
  "with_meal",
  "pre_workout",
  "post_workout",
  "bedtime",
] as const;
export type SupplementTiming = (typeof SUPPLEMENT_TIMINGS)[number];

export const HABIT_TYPES = ["manual", "auto"] as const;
export type HabitType = (typeof HABIT_TYPES)[number];

/** Habits evaluated automatically from logged data. */
export const AUTO_HABIT_METRICS = [
  "weight_logged",
  "nutrition_logged",
  "calories_target",
  "protein_target",
  "steps_target",
  "workout",
  "cardio",
  "water_target",
  "sleep_target",
  "supplements",
] as const;
export type AutoHabitMetric = (typeof AUTO_HABIT_METRICS)[number];

export const HABIT_SCHEDULES = ["daily", "specific_days"] as const;
export type HabitSchedule = (typeof HABIT_SCHEDULES)[number];

export const NOTE_TAGS = [
  "low_energy",
  "high_energy",
  "great_workout",
  "ate_out",
  "poor_sleep",
  "stress",
  "sick",
  "travel",
  "alcohol",
  "sore",
] as const;
export type NoteTag = (typeof NOTE_TAGS)[number];

export const HEALTH_METRICS = ["resting_hr", "avg_hr", "hrv", "active_energy", "vo2max"] as const;
export type HealthMetric = (typeof HEALTH_METRICS)[number];

export const REMINDER_KINDS = ["weight", "workout", "supplements", "water", "steps", "nutrition", "sleep"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

/** Dashboard cards that can be shown, hidden and reordered. */
export const DASHBOARD_CARDS = [
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
] as const;
export type DashboardCard = (typeof DASHBOARD_CARDS)[number];

export const SCORE_COMPONENTS = ["calories", "protein", "steps", "workout", "cardio", "sleep", "water"] as const;
export type ScoreComponent = (typeof SCORE_COMPONENTS)[number];
