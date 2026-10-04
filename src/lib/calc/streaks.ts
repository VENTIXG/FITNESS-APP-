/**
 * Streaks — reported factually (no loss-aversion nudges, no badges).
 */
import { addDays, startOfWeek, type ISODate } from "../dates";

export type Streak = { current: number; best: number };

/**
 * Consecutive days satisfying a condition, counting back from `today`. If today
 * isn't satisfied yet it doesn't break the streak (the day isn't over).
 */
export function dailyStreak(satisfied: ReadonlySet<ISODate>, today: ISODate, earliest: ISODate): Streak {
  let current = 0;
  let cursor = satisfied.has(today) ? today : addDays(today, -1);
  while (cursor >= earliest && satisfied.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  let best = 0;
  let run = 0;
  for (let d = earliest; d <= today; d = addDays(d, 1)) {
    if (satisfied.has(d)) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return { current, best: Math.max(best, current) };
}

/**
 * Consecutive weeks meeting a per-week target (e.g. completed ≥ planned workouts).
 * The current week counts once it's met; an unfinished current week doesn't break it.
 */
export function weeklyStreak(
  countsByWeekStart: ReadonlyMap<ISODate, number>,
  target: number,
  today: ISODate,
  weekStartsOn: number,
  earliest: ISODate,
): Streak {
  if (target <= 0) return { current: 0, best: 0 };
  const thisWeek = startOfWeek(today, weekStartsOn);
  const met = (w: ISODate) => (countsByWeekStart.get(w) ?? 0) >= target;
  let current = 0;
  let cursor = met(thisWeek) ? thisWeek : addDays(thisWeek, -7);
  const firstWeek = startOfWeek(earliest, weekStartsOn);
  while (cursor >= firstWeek && met(cursor)) {
    current += 1;
    cursor = addDays(cursor, -7);
  }
  let best = 0;
  let run = 0;
  for (let w = firstWeek; w <= thisWeek; w = addDays(w, 7)) {
    if (met(w)) {
      run += 1;
      best = Math.max(best, run);
    } else if (w !== thisWeek) {
      run = 0;
    }
  }
  return { current, best: Math.max(best, current) };
}
