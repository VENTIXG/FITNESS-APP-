/**
 * Calendar-date helpers operating on ISO date strings (YYYY-MM-DD).
 *
 * Day-based data (weights, meals, steps...) belongs to the user's *local* calendar
 * day, so we never convert these through JS Date local time. All arithmetic is
 * done in UTC on midnight timestamps, which has no DST edge cases.
 */

export type ISODate = string;

const DAY_MS = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== "string") return false;
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export function toUTC(date: ISODate): number {
  const m = ISO_RE.exec(date);
  if (!m) throw new Error(`Invalid ISO date: ${date}`);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}

export function fromUTC(ms: number): ISODate {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromUTC(toUTC(date) + days * DAY_MS);
}

/** a − b in whole days. */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(a) - toUTC(b)) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(date: ISODate): number {
  return new Date(toUTC(date)).getUTCDay();
}

export function startOfWeek(date: ISODate, weekStartsOn: number = 1): ISODate {
  const wd = weekday(date);
  const delta = (wd - weekStartsOn + 7) % 7;
  return addDays(date, -delta);
}

export function endOfWeek(date: ISODate, weekStartsOn: number = 1): ISODate {
  return addDays(startOfWeek(date, weekStartsOn), 6);
}

export function startOfMonth(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: ISODate): ISODate {
  const d = new Date(toUTC(startOfMonth(date)));
  return fromUTC(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

export function addMonths(date: ISODate, months: number): ISODate {
  const d = new Date(toUTC(date));
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return fromUTC(target.getTime());
}

export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const days: ISODate[] = [];
  for (let t = toUTC(start), last = toUTC(end); t <= last; t += DAY_MS) days.push(fromUTC(t));
  return days;
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a <= b ? a : b;
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a >= b ? a : b;
}

export function isBetween(date: ISODate, start: ISODate, end: ISODate): boolean {
  return date >= start && date <= end;
}

/** ISO-8601 week number and week-year. */
export function isoWeek(date: ISODate): { year: number; week: number } {
  const d = new Date(toUTC(date));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / DAY_MS + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function zonedParts(timeZone: string, now: Date) {
  const tz = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** The current calendar date in an IANA timezone. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): ISODate {
  const p = zonedParts(timeZone, now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Local wall-clock time "HH:MM" in an IANA timezone. */
export function timeInTimeZone(timeZone: string, now: Date = new Date()): string {
  const p = zonedParts(timeZone, now);
  return `${p.hour}:${p.minute}`;
}

/** The calendar date of an instant in an IANA timezone. */
export function dateOfInstant(instant: Date, timeZone: string): ISODate {
  return todayInTimeZone(timeZone, instant);
}

/** Minutes between two "HH:MM[:SS]" clock times, wrapping past midnight. */
export function minutesBetweenClockTimes(start: string, end: string): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  let diff = toMin(end) - toMin(start);
  if (diff <= 0) diff += 24 * 60;
  return diff;
}
