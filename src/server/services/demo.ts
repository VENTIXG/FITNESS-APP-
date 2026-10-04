import "server-only";
import { and, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { BUILTIN_EXERCISES } from "@/data/exercises";
import { BUILTIN_FOODS } from "@/data/foods";
import { addDays, eachDay, minutesBetweenClockTimes, weekday, type ISODate } from "@/lib/dates";
import type { CardioActivity, NoteTag } from "@/lib/domain";
import { builtinExerciseId, builtinFoodId } from "@/server/catalog/stable-id";
import type { DbOrTx } from "@/server/db";
import {
  bodyCompositionEntries,
  bodyMeasurements,
  cardioSessions,
  dailyNotes,
  exercises,
  exerciseSets,
  favoriteFoods,
  foodEntries,
  foods,
  goals,
  habitLogs,
  habits,
  nutritionTargets,
  profiles,
  programDays,
  programExercises,
  programs,
  recipeIngredients,
  recipes,
  savedMealItems,
  savedMeals,
  sleepEntries,
  stepEntries,
  supplementLogs,
  supplements,
  waterEntries,
  weightEntries,
  workoutExercises,
  workouts,
} from "@/server/db/schema";
import { recomputeRecords } from "./records";

/** Deterministic PRNG so demo data is identical on every run. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAYS = 120;
const foodByKey = new Map(BUILTIN_FOODS.map((f) => [f.key, f]));

type Portion = [key: string, grams: number];
const BREAKFASTS: Portion[][] = [
  [["oats", 60], ["whey-protein", 30], ["banana", 118], ["milk-semi", 200]],
  [["greek-yogurt-2", 250], ["granola", 40], ["blueberries", 100], ["honey", 10]],
  [["egg-whole", 150], ["bread-wholewheat", 60], ["feta", 30], ["tomato", 120]],
];
const LUNCHES: Portion[][] = [
  [["chicken-breast-cooked", 180], ["rice-white-cooked", 220], ["greek-salad", 200]],
  [["beef-mince-5", 150], ["pasta-dry", 90], ["tomato", 100], ["parmesan", 10]],
  [["tuna-water", 112], ["potato-boiled", 250], ["olive-oil", 10], ["lettuce", 100]],
  [["chicken-breast-cooked", 160], ["quinoa-cooked", 200], ["avocado", 60], ["bell-pepper", 100]],
];
const DINNERS: Portion[][] = [
  [["salmon-raw", 170], ["sweet-potato-baked", 250], ["broccoli", 150], ["olive-oil", 8]],
  [["chicken-thigh-cooked", 180], ["bulgur-cooked", 200], ["zucchini", 150]],
  [["lentils-cooked", 350], ["bread-wholewheat", 30], ["feta", 40]],
  [["pork-souvlaki", 210], ["pita-bread", 80], ["tzatziki", 60], ["greek-salad", 150]],
  [["cod-raw", 220], ["potato-boiled", 250], ["green-beans", 150], ["olive-oil", 10]],
];
const SNACKS: Portion[][] = [
  [["skyr", 200], ["almonds", 20]],
  [["protein-bar", 60]],
  [["apple", 182], ["peanut-butter", 16]],
  [["cottage-cheese", 200], ["strawberries", 120]],
  [["dark-chocolate", 20], ["orange", 131]],
];
const EAT_OUT: Portion[][] = [[["pita-gyros", 560]], [["pizza-margherita", 320]], [["moussaka", 400], ["greek-salad", 150]]];

function nutrientsFor(key: string, grams: number) {
  const f = foodByKey.get(key);
  if (!f) throw new Error(`Unknown demo food ${key}`);
  const k = grams / 100;
  return {
    calories: f.kcal * k,
    proteinG: f.p * k,
    carbsG: f.c * k,
    fatG: f.f * k,
    fiberG: (f.fiber ?? 0) * k,
    sugarG: f.sugar != null ? f.sugar * k : null,
    name: f.name,
    unit: f.unit ?? "g",
  };
}

type Lift = { key: string; weight: number; repMin: number; repMax: number; inc: number; sets: number; bodyweight?: boolean };

export async function generateDemoData(tx: DbOrTx, userId: string, today: ISODate) {
  const rnd = mulberry32(20261004);
  const noise = (sd: number) => {
    // Box–Muller
    const u = Math.max(1e-9, rnd());
    const v = rnd();
    return sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)];
  const start = addDays(today, -(DAYS - 1));
  const days = eachDay(start, today);

  // ── Profile defaults (only fill blanks; never overwrite real values) ─────
  const profile = (await tx.select().from(profiles).where(eq(profiles.userId, userId)).limit(1))[0];
  if (profile) {
    await tx
      .update(profiles)
      .set({
        heightCm: profile.heightCm ?? 180,
        sex: profile.sex ?? "male",
        birthDate: profile.birthDate ?? "1992-05-14",
        trainingDaysPerWeek: profile.trainingDaysPerWeek ?? 4,
      })
      .where(eq(profiles.userId, userId));
  }

  // ── Targets (only when the user has none) ─────────────────────────────────
  const hasTargets = await tx.select({ id: nutritionTargets.id }).from(nutritionTargets).where(eq(nutritionTargets.userId, userId)).limit(1);
  if (!hasTargets.length) {
    await tx.insert(nutritionTargets).values([
      { userId, effectiveFrom: start, calories: 2300, proteinG: 180, carbsG: 230, fatG: 72, fiberG: 35 },
      { userId, effectiveFrom: addDays(start, 63), calories: 2200, proteinG: 180, carbsG: 205, fatG: 70, fiberG: 35 },
    ]);
  }

  // ── Goal ────────────────────────────────────────────────────────────────
  const hasGoal = await tx.select({ id: goals.id }).from(goals).where(and(eq(goals.userId, userId), eq(goals.status, "active"))).limit(1);
  if (!hasGoal.length) {
    await tx.insert(goals).values({
      userId,
      startDate: start,
      startWeightKg: 92.4,
      targetWeightKg: 82,
      targetBodyFatPct: 15,
      targetDate: addDays(start, 230),
      isDemo: true,
    });
  }

  // ── Weight: true trend with a mid-cut plateau, plus water noise ──────────
  const trendAt = (i: number) => {
    const w = i / 7;
    let kg = 92.4;
    kg -= Math.min(w, 6) * 0.62;
    if (w > 6) kg -= Math.min(w - 6, 4) * 0.42;
    if (w > 12) kg -= (w - 12) * 0.5; // weeks 10–12 plateau
    return kg;
  };
  const weightRows = days
    .map((date, i) => ({ date, i }))
    .filter(({ date, i }) => date === today || rnd() < 0.88 || i === 0)
    .map(({ date, i }) => ({
      userId,
      date,
      weightKg: Math.round((trendAt(i) + noise(0.32) + (weekday(date) === 1 ? 0.35 : 0)) * 10) / 10,
      source: "manual" as const,
      isDemo: true,
    }));
  await tx.insert(weightEntries).values(weightRows).onConflictDoNothing();

  // ── Nutrition ────────────────────────────────────────────────────────────
  const entryRows: (typeof foodEntries.$inferInsert)[] = [];
  days.forEach((date, i) => {
    if (date !== today && rnd() < 0.06) return; // missed logging days
    const target = i < 63 ? 2300 : 2200;
    const wd = weekday(date);
    const weekend = wd === 0 || wd === 6;
    const eatOut = weekend && rnd() < 0.45;
    const plan: [string, Portion[]][] = [
      ["breakfast", pick(BREAKFASTS)],
      ["lunch", eatOut && wd === 6 ? pick(EAT_OUT) : pick(LUNCHES)],
      ["dinner", eatOut && wd === 0 ? pick(EAT_OUT) : pick(DINNERS)],
      ["snacks", pick(SNACKS)],
    ];
    if (rnd() < 0.5) plan.push(["snacks", pick(SNACKS)]);
    const base = plan.flatMap(([, ps]) => ps).reduce((a, [k, g]) => a + nutrientsFor(k, g).calories, 0);
    const desired = target + noise(110) + (weekend ? 260 : 0);
    const scale = Math.max(0.75, Math.min(1.3, desired / base));
    const slots = date === today ? plan.slice(0, 1) : plan;
    let order = 0;
    for (const [slot, portions] of slots) {
      for (const [key, grams] of portions) {
        const g = Math.round((grams * scale) / 5) * 5;
        const n = nutrientsFor(key, g);
        const f = foodByKey.get(key)!;
        const serving = f.defaultServing ? f.servings?.find((s) => s.id === f.defaultServing) : undefined;
        entryRows.push({
          userId,
          date,
          mealSlot: slot,
          foodId: builtinFoodId(key),
          name: n.name,
          quantity: serving ? Math.round((g / serving.amount) * 10) / 10 : g,
          unit: serving ? serving.id : n.unit,
          baseAmount: g,
          calories: n.calories,
          proteinG: n.proteinG,
          carbsG: n.carbsG,
          fatG: n.fatG,
          fiberG: n.fiberG,
          sugarG: n.sugarG,
          sortOrder: order++,
          loggedAt: new Date(`${date}T${slot === "breakfast" ? "08" : slot === "lunch" ? "13" : slot === "dinner" ? "20" : "16"}:30:00Z`),
          isDemo: true,
        });
      }
    }
  });
  for (let i = 0; i < entryRows.length; i += 500) await tx.insert(foodEntries).values(entryRows.slice(i, i + 500));

  // Favorites, a custom food, saved meals and a recipe.
  for (const key of ["oats", "whey-protein", "chicken-breast-cooked", "greek-yogurt-2"]) {
    await tx.insert(favoriteFoods).values({ userId, foodId: builtinFoodId(key) }).onConflictDoNothing();
  }
  await tx.insert(foods).values({
    userId,
    name: "Homemade protein granola",
    baseUnit: "g",
    calories: 430,
    proteinG: 24,
    carbsG: 48,
    fatG: 15,
    fiberG: 7,
    servings: [{ id: "portion", label: "portion (45 g)", amount: 45 }],
    defaultServingId: "portion",
    source: "custom",
    isDemo: true,
  });
  const [breakfastMeal] = await tx.insert(savedMeals).values({ userId, name: "Usual breakfast", mealSlot: "breakfast", isFavorite: true, useCount: 34, isDemo: true }).returning({ id: savedMeals.id });
  await tx.insert(savedMealItems).values(
    BREAKFASTS[0].map(([key, grams], i) => ({ savedMealId: breakfastMeal.id, foodId: builtinFoodId(key), quantity: grams, unit: foodByKey.get(key)!.unit ?? "g", baseAmount: grams, sortOrder: i })),
  );
  const [shake] = await tx.insert(savedMeals).values({ userId, name: "Post-workout shake", mealSlot: "snacks", useCount: 18, isDemo: true }).returning({ id: savedMeals.id });
  await tx.insert(savedMealItems).values([
    { savedMealId: shake.id, foodId: builtinFoodId("whey-protein"), quantity: 1, unit: "scoop", baseAmount: 30, sortOrder: 0 },
    { savedMealId: shake.id, foodId: builtinFoodId("banana"), quantity: 1, unit: "medium", baseAmount: 118, sortOrder: 1 },
    { savedMealId: shake.id, foodId: builtinFoodId("milk-semi"), quantity: 300, unit: "ml", baseAmount: 300, sortOrder: 2 },
  ]);
  const [pancakes] = await tx
    .insert(recipes)
    .values({ userId, name: "Protein pancakes", servings: 2, totalWeightG: 330, instructions: "Blend everything, rest 5 minutes, cook on a non-stick pan over medium heat.", isFavorite: true, isDemo: true })
    .returning({ id: recipes.id });
  await tx.insert(recipeIngredients).values([
    { recipeId: pancakes.id, foodId: builtinFoodId("oats"), quantity: 80, unit: "g", baseAmount: 80, sortOrder: 0 },
    { recipeId: pancakes.id, foodId: builtinFoodId("egg-whole"), quantity: 2, unit: "large", baseAmount: 100, sortOrder: 1 },
    { recipeId: pancakes.id, foodId: builtinFoodId("whey-protein"), quantity: 1, unit: "scoop", baseAmount: 30, sortOrder: 2 },
    { recipeId: pancakes.id, foodId: builtinFoodId("milk-semi"), quantity: 120, unit: "ml", baseAmount: 120, sortOrder: 3 },
  ]);

  // ── Training: Upper/Lower (active) + PPL (inactive) ────────────────────────
  const hasActive = await tx.select({ id: programs.id }).from(programs).where(and(eq(programs.userId, userId), eq(programs.isActive, true))).limit(1);
  const programId = crypto.randomUUID();
  await tx.insert(programs).values({ id: programId, userId, name: "Upper / Lower", description: "4-day split focused on strength retention during a cut.", scheduleType: "weekly", daysPerWeek: 4, isActive: !hasActive.length, isDemo: true });
  const LIFTS: Record<string, Lift[]> = {
    "Upper A": [
      { key: "barbell-bench-press", weight: 80, repMin: 6, repMax: 8, inc: 2.5, sets: 3 },
      { key: "barbell-row", weight: 70, repMin: 8, repMax: 10, inc: 2.5, sets: 3 },
      { key: "overhead-press", weight: 45, repMin: 6, repMax: 10, inc: 2.5, sets: 3 },
      { key: "lat-pulldown", weight: 60, repMin: 10, repMax: 12, inc: 2.5, sets: 3 },
      { key: "ez-bar-curl", weight: 30, repMin: 10, repMax: 12, inc: 2.5, sets: 2 },
      { key: "triceps-pushdown", weight: 25, repMin: 10, repMax: 15, inc: 2.5, sets: 2 },
    ],
    "Lower A": [
      { key: "back-squat", weight: 100, repMin: 5, repMax: 8, inc: 5, sets: 3 },
      { key: "romanian-deadlift", weight: 90, repMin: 8, repMax: 10, inc: 5, sets: 3 },
      { key: "leg-press", weight: 160, repMin: 10, repMax: 12, inc: 10, sets: 3 },
      { key: "lying-leg-curl", weight: 45, repMin: 10, repMax: 12, inc: 2.5, sets: 3 },
      { key: "standing-calf-raise", weight: 80, repMin: 10, repMax: 15, inc: 5, sets: 3 },
    ],
    "Upper B": [
      { key: "incline-dumbbell-bench-press", weight: 28, repMin: 8, repMax: 12, inc: 2, sets: 3 },
      { key: "pull-up", weight: 0, repMin: 6, repMax: 10, inc: 2.5, sets: 3, bodyweight: true },
      { key: "seated-dumbbell-press", weight: 24, repMin: 8, repMax: 12, inc: 2, sets: 3 },
      { key: "seated-cable-row", weight: 60, repMin: 10, repMax: 12, inc: 2.5, sets: 3 },
      { key: "lateral-raise", weight: 10, repMin: 12, repMax: 15, inc: 1, sets: 3 },
      { key: "hammer-curl", weight: 16, repMin: 10, repMax: 12, inc: 2, sets: 2 },
    ],
    "Lower B": [
      { key: "deadlift", weight: 140, repMin: 3, repMax: 6, inc: 5, sets: 3 },
      { key: "bulgarian-split-squat", weight: 16, repMin: 8, repMax: 12, inc: 2, sets: 3 },
      { key: "leg-extension", weight: 50, repMin: 10, repMax: 15, inc: 5, sets: 3 },
      { key: "seated-leg-curl", weight: 45, repMin: 10, repMax: 15, inc: 2.5, sets: 3 },
      { key: "hanging-leg-raise", weight: 0, repMin: 8, repMax: 15, inc: 2.5, sets: 3, bodyweight: true },
    ],
  };
  const dayDefs: { name: keyof typeof LIFTS; weekday: number }[] = [
    { name: "Upper A", weekday: 1 },
    { name: "Lower A", weekday: 2 },
    { name: "Upper B", weekday: 4 },
    { name: "Lower B", weekday: 5 },
  ];
  const dayIds: Record<string, string> = {};
  for (const [i, def] of dayDefs.entries()) {
    const id = crypto.randomUUID();
    dayIds[def.name] = id;
    await tx.insert(programDays).values({ id, programId, name: def.name, sortOrder: i, weekdays: [def.weekday] });
    await tx.insert(programExercises).values(
      LIFTS[def.name].map((l, j) => ({ programDayId: id, exerciseId: builtinExerciseId(l.key), sortOrder: j, targetSets: l.sets, repMin: l.repMin, repMax: l.repMax, targetRir: 2, restSeconds: l.repMax <= 8 ? 180 : 120 })),
    );
  }
  const pplId = crypto.randomUUID();
  await tx.insert(programs).values({ id: pplId, userId, name: "Push / Pull / Legs", scheduleType: "rotation", daysPerWeek: 6, isActive: false, isDemo: true });
  for (const [i, [name, keys]] of ([["Push", ["barbell-bench-press", "seated-dumbbell-press", "lateral-raise", "rope-pushdown"]], ["Pull", ["pull-up", "barbell-row", "face-pull", "dumbbell-curl"]], ["Legs", ["back-squat", "romanian-deadlift", "leg-press", "standing-calf-raise"]]] as const).entries()) {
    const id = crypto.randomUUID();
    await tx.insert(programDays).values({ id, programId: pplId, name, sortOrder: i });
    await tx.insert(programExercises).values(keys.map((key, j) => ({ programDayId: id, exerciseId: builtinExerciseId(key), sortOrder: j, targetSets: 3, repMin: 8, repMax: 12, restSeconds: 120 })));
  }

  // Simulate double progression session by session.
  const state = new Map<string, { weight: number; reps: number[] }>();
  const workoutRows: (typeof workouts.$inferInsert)[] = [];
  const weRows: (typeof workoutExercises.$inferInsert)[] = [];
  const setRows: (typeof exerciseSets.$inferInsert)[] = [];
  for (const date of days) {
    if (date === today) break;
    const def = dayDefs.find((d) => d.weekday === weekday(date));
    if (!def || rnd() < 0.09) continue;
    const workoutId = crypto.randomUUID();
    const startedAt = new Date(`${date}T16:${String(Math.floor(rnd() * 50)).padStart(2, "0")}:00Z`);
    const duration = Math.round((55 + rnd() * 20) * 60);
    workoutRows.push({ id: workoutId, userId, date, name: def.name, programId, programDayId: dayIds[def.name], status: "completed", startedAt, finishedAt: new Date(startedAt.getTime() + duration * 1000), durationSeconds: duration, sessionRpe: Math.round((7 + rnd() * 2) * 2) / 2, isDemo: true });
    for (const [j, lift] of LIFTS[def.name].entries()) {
      const s = state.get(lift.key) ?? { weight: lift.weight, reps: Array(lift.sets).fill(lift.repMin) };
      const weId = crypto.randomUUID();
      weRows.push({ id: weId, workoutId, exerciseId: builtinExerciseId(lift.key), sortOrder: j, repMin: lift.repMin, repMax: lift.repMax, restSeconds: lift.repMax <= 8 ? 180 : 120 });
      let idx = 0;
      if (j === 0 && !lift.bodyweight) {
        setRows.push({ id: crypto.randomUUID(), workoutExerciseId: weId, setIndex: idx++, setType: "warmup", weightKg: Math.round((s.weight * 0.6) / 2.5) * 2.5, reps: 8, completed: true, completedAt: startedAt });
      }
      s.reps.forEach((reps, k) => {
        setRows.push({
          id: crypto.randomUUID(),
          workoutExerciseId: weId,
          setIndex: idx++,
          setType: "normal",
          weightKg: lift.bodyweight ? null : s.weight,
          reps,
          rir: Math.max(0, Math.min(4, Math.round(2 + noise(0.8) - k * 0.4))),
          completed: true,
          completedAt: new Date(startedAt.getTime() + (j * 10 + k * 3) * 60000),
        });
      });
      // Next session: add reps (with occasional misses in a deficit), then load.
      if (s.reps.every((r) => r >= lift.repMax)) {
        state.set(lift.key, { weight: lift.bodyweight ? s.weight : s.weight + lift.inc, reps: Array(lift.sets).fill(lift.repMin) });
      } else {
        state.set(lift.key, { weight: s.weight, reps: s.reps.map((r, k) => (rnd() < 0.72 - k * 0.12 ? Math.min(lift.repMax, r + 1) : r)) });
      }
    }
  }
  if (workoutRows.length) await tx.insert(workouts).values(workoutRows);
  for (let i = 0; i < weRows.length; i += 500) await tx.insert(workoutExercises).values(weRows.slice(i, i + 500));
  for (let i = 0; i < setRows.length; i += 500) await tx.insert(exerciseSets).values(setRows.slice(i, i + 500));
  const allLiftIds = [...new Set(Object.values(LIFTS).flat().map((l) => builtinExerciseId(l.key)))];
  await recomputeRecords(tx, userId, allLiftIds);

  // ── Cardio & steps ────────────────────────────────────────────────────────
  const cardioRows: (typeof cardioSessions.$inferInsert)[] = [];
  const stepRows: (typeof stepEntries.$inferInsert)[] = [];
  days.forEach((date, i) => {
    const wd = weekday(date);
    const progress = i / DAYS;
    if (date !== today) {
      if ([0, 3, 6].includes(wd) || rnd() < 0.25) {
        const minutes = 30 + Math.round(rnd() * 30);
        cardioRows.push({ userId, date, activity: "walking", durationSeconds: minutes * 60, distanceM: Math.round(minutes * (85 + rnd() * 10)), avgHeartRate: Math.round(102 + rnd() * 14), calories: Math.round(minutes * 4.6), source: "manual", isDemo: true });
      }
      if ([2, 5].includes(wd) && rnd() < 0.8) {
        cardioRows.push({ userId, date, activity: "treadmill", durationSeconds: 1800, distanceM: 2700, avgHeartRate: Math.round(122 + rnd() * 10), maxHeartRate: 138, calories: 260, inclinePct: 10 + Math.round(rnd() * 4), speedKmh: 5.4, source: "manual", isDemo: true });
      }
      if (wd === 6 && rnd() < 0.4) {
        const activity: CardioActivity = rnd() < 0.5 ? "cycling" : "hiking";
        cardioRows.push({ userId, date, activity, durationSeconds: 2700 + Math.round(rnd() * 1800), distanceM: activity === "cycling" ? 18000 + Math.round(rnd() * 8000) : 7000, avgHeartRate: 128, calories: 420, source: "manual", isDemo: true });
      }
    }
    const base = 7600 + progress * 2600 + ([0, 6].includes(wd) ? -800 : 0);
    const steps = Math.max(1500, Math.round(base + noise(1900)));
    stepRows.push({ userId, date, steps: date === today ? Math.round(steps * 0.45) : steps, source: rnd() < 0.85 ? "apple_health" : "manual", isDemo: true });
  });
  for (let i = 0; i < cardioRows.length; i += 500) await tx.insert(cardioSessions).values(cardioRows.slice(i, i + 500));
  await tx.insert(stepEntries).values(stepRows).onConflictDoNothing();

  // ── Water & sleep ───────────────────────────────────────────────────────────
  const waterRows: (typeof waterEntries.$inferInsert)[] = [];
  const sleepRows: (typeof sleepEntries.$inferInsert)[] = [];
  for (const date of days) {
    const glasses = date === today ? 3 : 6 + Math.floor(rnd() * 5);
    for (let g = 0; g < glasses; g++) {
      waterRows.push({ userId, date, amountMl: rnd() < 0.7 ? 250 : 500, loggedAt: new Date(`${date}T${String(8 + g).padStart(2, "0")}:15:00Z`), isDemo: true });
    }
    if (rnd() < 0.9) {
      const bedMin = 22 * 60 + 45 + Math.round(rnd() * 100);
      const wakeMin = 6 * 60 + 40 + Math.round(rnd() * 70);
      const bed = `${String(Math.floor(bedMin / 60) % 24).padStart(2, "0")}:${String(bedMin % 60).padStart(2, "0")}`;
      const wake = `${String(Math.floor(wakeMin / 60)).padStart(2, "0")}:${String(wakeMin % 60).padStart(2, "0")}`;
      sleepRows.push({ userId, date, bedTime: bed, wakeTime: wake, durationMinutes: minutesBetweenClockTimes(bed, wake), quality: Math.max(1, Math.min(5, Math.round(3.6 + noise(0.8)))), source: "manual", isDemo: true });
    }
  }
  for (let i = 0; i < waterRows.length; i += 500) await tx.insert(waterEntries).values(waterRows.slice(i, i + 500));
  await tx.insert(sleepEntries).values(sleepRows).onConflictDoNothing();

  // ── Supplements & habits ────────────────────────────────────────────────────
  const createdAt = new Date(`${start}T06:00:00Z`);
  const supps = await tx
    .insert(supplements)
    .values([
      { userId, name: "Creatine monohydrate", dose: 5, doseUnit: "g", schedule: "daily", timing: "morning", sortOrder: 0, isDemo: true, createdAt },
      { userId, name: "Vitamin D3", dose: 2000, doseUnit: "IU", schedule: "daily", timing: "with_meal", sortOrder: 1, isDemo: true, createdAt },
      { userId, name: "Omega-3", dose: 2, doseUnit: "caps", schedule: "daily", timing: "with_meal", sortOrder: 2, isDemo: true, createdAt },
    ])
    .returning({ id: supplements.id });
  const suppLogRows: (typeof supplementLogs.$inferInsert)[] = [];
  for (const date of days) {
    if (date === today) continue;
    for (const s of supps) if (rnd() < 0.9) suppLogRows.push({ userId, supplementId: s.id, date });
  }
  await tx.insert(supplementLogs).values(suppLogRows).onConflictDoNothing();

  const manualHabits = await tx
    .insert(habits)
    .values([
      { userId, name: "Stretch 10 minutes", type: "manual", schedule: "daily", sortOrder: 50, isDemo: true, createdAt },
      { userId, name: "No alcohol", type: "manual", schedule: "daily", sortOrder: 51, isDemo: true, createdAt },
    ])
    .returning({ id: habits.id });
  const habitLogRows: (typeof habitLogs.$inferInsert)[] = [];
  for (const date of days) {
    if (date === today) continue;
    for (const [k, h] of manualHabits.entries()) if (rnd() < (k === 0 ? 0.65 : 0.85)) habitLogRows.push({ userId, habitId: h.id, date });
  }
  await tx.insert(habitLogs).values(habitLogRows).onConflictDoNothing();
  // Backdate the default habits so their history covers the demo period.
  await tx.update(habits).set({ createdAt }).where(and(eq(habits.userId, userId), eq(habits.isDemo, false), gt(habits.createdAt, createdAt)));

  // ── Body composition & measurements (every 2 weeks) ──────────────────────────
  for (let i = 0; i < DAYS; i += 14) {
    const date = addDays(start, i);
    const p = i / DAYS;
    await tx.insert(bodyCompositionEntries).values({ userId, date, bodyFatPct: Math.round((22.1 - p * 3.6 + noise(0.3)) * 10) / 10, method: "bia_scale", isDemo: true }).onConflictDoNothing();
    await tx
      .insert(bodyMeasurements)
      .values({
        userId,
        date,
        waistCm: Math.round((96.5 - p * 7.2 + noise(0.4)) * 10) / 10,
        chestCm: Math.round((108 - p * 2.6) * 10) / 10,
        neckCm: Math.round((40.2 - p * 1.1) * 10) / 10,
        shouldersCm: Math.round((124 - p * 1.2) * 10) / 10,
        leftArmCm: Math.round((37.2 + p * 0.3) * 10) / 10,
        rightArmCm: Math.round((37.6 + p * 0.3) * 10) / 10,
        hipsCm: Math.round((104 - p * 4.2) * 10) / 10,
        leftThighCm: Math.round((60.5 - p * 2.1) * 10) / 10,
        rightThighCm: Math.round((60.8 - p * 2.1) * 10) / 10,
        calfCm: 39,
        isDemo: true,
      })
      .onConflictDoNothing();
  }

  // ── Daily notes ──────────────────────────────────────────────────────────────
  const noteSamples: [string, NoteTag[], number][] = [
    ["Felt strong on bench today.", ["great_workout", "high_energy"], 4],
    ["Dinner out with friends, estimated portions.", ["ate_out"], 3],
    ["Short night, low energy in the afternoon.", ["poor_sleep", "low_energy"], 2],
    ["Busy day at work.", ["stress"], 3],
    ["Legs still sore from Tuesday.", ["sore"], 3],
    ["Weekend trip, mostly walking.", ["travel"], 4],
  ];
  const noteRows = noteSamples.map(([content, tags, energy], k) => ({ userId, date: addDays(today, -(4 + k * 13)), content, tags, energy, isDemo: true }));
  await tx.insert(dailyNotes).values(noteRows).onConflictDoNothing();
}

/** Counts demo rows in an account. */
export async function countDemoRows(tx: DbOrTx, userId: string) {
  const res = await tx.execute<{ n: number }>(sql`
    select (
      (select count(*) from ${weightEntries} where user_id = ${userId} and is_demo) +
      (select count(*) from ${foodEntries} where user_id = ${userId} and is_demo) +
      (select count(*) from ${workouts} where user_id = ${userId} and is_demo) +
      (select count(*) from ${cardioSessions} where user_id = ${userId} and is_demo) +
      (select count(*) from ${stepEntries} where user_id = ${userId} and is_demo) +
      (select count(*) from ${waterEntries} where user_id = ${userId} and is_demo) +
      (select count(*) from ${sleepEntries} where user_id = ${userId} and is_demo) +
      (select count(*) from ${bodyCompositionEntries} where user_id = ${userId} and is_demo) +
      (select count(*) from ${bodyMeasurements} where user_id = ${userId} and is_demo) +
      (select count(*) from ${supplements} where user_id = ${userId} and is_demo) +
      (select count(*) from ${habits} where user_id = ${userId} and is_demo) +
      (select count(*) from ${programs} where user_id = ${userId} and is_demo) +
      (select count(*) from ${dailyNotes} where user_id = ${userId} and is_demo) +
      (select count(*) from ${goals} where user_id = ${userId} and is_demo) +
      (select count(*) from ${savedMeals} where user_id = ${userId} and is_demo) +
      (select count(*) from ${recipes} where user_id = ${userId} and is_demo) +
      (select count(*) from ${foods} where user_id = ${userId} and is_demo)
    )::int as n`);
  return Number(res[0]?.n ?? 0);
}

/** Removes every demo-tagged row, leaving real entries untouched; rebuilds PRs afterwards. */
export async function removeDemoData(tx: DbOrTx, userId: string) {
  const touchedExercises = await tx
    .selectDistinct({ id: workoutExercises.exerciseId })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(eq(workouts.userId, userId));

  await tx.delete(foodEntries).where(and(eq(foodEntries.userId, userId), eq(foodEntries.isDemo, true)));
  await tx.delete(savedMeals).where(and(eq(savedMeals.userId, userId), eq(savedMeals.isDemo, true)));
  await tx.delete(recipes).where(and(eq(recipes.userId, userId), eq(recipes.isDemo, true)));
  // Demo foods still referenced by real recipes/meals are archived instead of deleted.
  const demoFoods = await tx.select({ id: foods.id }).from(foods).where(and(eq(foods.userId, userId), eq(foods.isDemo, true)));
  for (const f of demoFoods) {
    const used = await tx.execute(sql`select 1 from ${recipeIngredients} where food_id = ${f.id} union all select 1 from ${savedMealItems} where food_id = ${f.id} limit 1`);
    if (used.length) await tx.update(foods).set({ archivedAt: new Date(), isDemo: false }).where(eq(foods.id, f.id));
    else await tx.delete(foods).where(eq(foods.id, f.id));
  }
  await tx.delete(workouts).where(and(eq(workouts.userId, userId), eq(workouts.isDemo, true)));
  await tx.delete(programs).where(and(eq(programs.userId, userId), eq(programs.isDemo, true)));
  for (const table of [weightEntries, bodyCompositionEntries, bodyMeasurements, cardioSessions, stepEntries, waterEntries, sleepEntries, supplements, habits, dailyNotes, goals] as const) {
    await tx.delete(table).where(and(eq(table.userId, userId), eq(table.isDemo, true)));
  }
  await recomputeRecords(tx, userId, touchedExercises.map((e) => e.id));
}

/** Built-in exercise keys are stable ids; used by the seed script sanity check. */
export async function catalogReady(tx: DbOrTx) {
  const rows = await tx
    .select({ id: exercises.id })
    .from(exercises)
    .where(and(inArray(exercises.id, [builtinExerciseId(BUILTIN_EXERCISES[0].key)]), or(isNull(exercises.userId))));
  return rows.length > 0;
}
