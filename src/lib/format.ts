/**
 * Locale-aware formatting used by both server and client components.
 * Greek uses comma decimals and dot thousands ("1.640 kcal", "84,2 kg").
 */
import type { Locale, UnitSystem } from "./domain";
import { toUTC, type ISODate } from "./dates";
import {
  distanceUnit,
  lengthUnit,
  toDisplayDistance,
  toDisplayLength,
  toDisplayVolume,
  toDisplayWeight,
  volumeUnit,
  weightUnit,
} from "./units";

export const intlLocale = (locale: Locale) => (locale === "el" ? "el-GR" : "en-GB");

const nfCache = new Map<string, Intl.NumberFormat>();
function nf(locale: Locale, min: number, max: number, signDisplay: "auto" | "exceptZero" = "auto") {
  const key = `${locale}|${min}|${max}|${signDisplay}`;
  let f = nfCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(intlLocale(locale), {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
      signDisplay,
    });
    nfCache.set(key, f);
  }
  return f;
}

/** Proper typographic minus for negative numbers. */
const fixMinus = (s: string) => s.replace(/^-/, "−");

export function fmtNumber(locale: Locale, value: number, decimals = 0, opts: { min?: number; signed?: boolean } = {}) {
  const s = nf(locale, opts.min ?? 0, decimals, opts.signed ? "exceptZero" : "auto").format(value);
  return fixMinus(s);
}

export function fmtInt(locale: Locale, value: number) {
  return fmtNumber(locale, Math.round(value), 0);
}

export function fmtPercent(locale: Locale, fraction: number, decimals = 0) {
  return `${fmtNumber(locale, fraction * 100, decimals)}%`;
}

export function fmtWeight(
  locale: Locale,
  system: UnitSystem,
  kg: number,
  opts: { decimals?: number; unit?: boolean; signed?: boolean } = {},
) {
  const value = toDisplayWeight(kg, system);
  const s = fmtNumber(locale, value, opts.decimals ?? 1, { min: opts.decimals ?? 1, signed: opts.signed });
  return opts.unit === false ? s : `${s} ${weightUnit(system)}`;
}

/** Weight with trimmed trailing zeros (for sets: "100 kg", "102.5 kg"). */
export function fmtLoad(locale: Locale, system: UnitSystem, kg: number, unit = true) {
  const value = toDisplayWeight(kg, system);
  const s = fmtNumber(locale, Math.round(value * 100) / 100, 2);
  return unit ? `${s} ${weightUnit(system)}` : s;
}

export function fmtLength(locale: Locale, system: UnitSystem, cm: number, opts: { decimals?: number; signed?: boolean } = {}) {
  const value = toDisplayLength(cm, system);
  return `${fmtNumber(locale, value, opts.decimals ?? 1, { min: 0, signed: opts.signed })} ${lengthUnit(system)}`;
}

export function fmtDistance(locale: Locale, system: UnitSystem, metres: number, decimals = 2) {
  return `${fmtNumber(locale, toDisplayDistance(metres, system), decimals)} ${distanceUnit(system)}`;
}

export function fmtVolume(locale: Locale, system: UnitSystem, ml: number) {
  if (system === "imperial") return `${fmtNumber(locale, toDisplayVolume(ml, system), 0)} ${volumeUnit(system)}`;
  if (ml >= 1000) return `${fmtNumber(locale, ml / 1000, 2)} L`;
  return `${fmtNumber(locale, ml, 0)} ml`;
}

export function fmtKcal(locale: Locale, kcal: number, unit = true) {
  const s = fmtInt(locale, kcal);
  return unit ? `${s} kcal` : s;
}

export function fmtGrams(locale: Locale, grams: number, decimals = 0) {
  return `${fmtNumber(locale, grams, decimals)} g`;
}

/** 3725 → "1:02:05", 1500 → "25:00" */
export function fmtClock(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 3900 → "1h 05m", 2700 → "45m" */
export function fmtDurationShort(seconds: number) {
  const totalMin = Math.round(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Minutes → "7h 30m" */
export function fmtSleep(minutes: number) {
  return fmtDurationShort(minutes * 60);
}

/** Pace seconds per unit → "5:32 /km" */
export function fmtPace(secondsPerUnit: number | null, system: UnitSystem) {
  if (secondsPerUnit == null || !Number.isFinite(secondsPerUnit)) return "—";
  return `${fmtClock(secondsPerUnit)} /${distanceUnit(system)}`;
}

export type DateStyle = "short" | "medium" | "long" | "weekday" | "weekdayShort" | "monthYear" | "dayMonth" | "monthShort";

/*
 * Calendar names are table-driven (not Intl) so server and browser render the exact
 * same text — ICU versions differ in punctuation, which breaks hydration.
 */
const NAMES = {
  en: {
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    monthsGen: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    daysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    daysNarrow: ["S", "M", "T", "W", "T", "F", "S"],
  },
  el: {
    months: ["Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος", "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος"],
    monthsGen: ["Ιανουαρίου", "Φεβρουαρίου", "Μαρτίου", "Απριλίου", "Μαΐου", "Ιουνίου", "Ιουλίου", "Αυγούστου", "Σεπτεμβρίου", "Οκτωβρίου", "Νοεμβρίου", "Δεκεμβρίου"],
    monthsShort: ["Ιαν", "Φεβ", "Μαρ", "Απρ", "Μαΐ", "Ιουν", "Ιουλ", "Αυγ", "Σεπ", "Οκτ", "Νοε", "Δεκ"],
    days: ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"],
    daysShort: ["Κυρ", "Δευ", "Τρί", "Τετ", "Πέμ", "Παρ", "Σάβ"],
    daysNarrow: ["Κ", "Δ", "Τ", "Τ", "Π", "Π", "Σ"],
  },
} as const;

/** Formats an ISO calendar date (no timezone shift — the date is already local). */
export function fmtDate(locale: Locale, date: ISODate, style: DateStyle = "medium") {
  const n = NAMES[locale] ?? NAMES.en;
  const d = new Date(toUTC(date));
  const day = d.getUTCDate();
  const m = d.getUTCMonth();
  const y = d.getUTCFullYear();
  const wd = d.getUTCDay();
  switch (style) {
    case "short":
      return `${day}/${m + 1}`;
    case "medium":
      return `${day} ${n.monthsShort[m]} ${y}`;
    case "long":
      return locale === "el" ? `${n.days[wd]} ${day} ${n.monthsGen[m]} ${y}` : `${n.days[wd]}, ${day} ${n.months[m]} ${y}`;
    case "weekday":
      return `${n.days[wd]} ${day} ${n.monthsGen[m]}`;
    case "weekdayShort":
      return `${n.daysShort[wd]} ${day} ${n.monthsShort[m]}`;
    case "monthYear":
      return `${n.months[m]} ${y}`;
    case "dayMonth":
      return `${day} ${n.monthsShort[m]}`;
    case "monthShort":
      return n.monthsShort[m];
  }
}

export function fmtWeekdayNarrow(locale: Locale, weekdayIndex: number) {
  return (NAMES[locale] ?? NAMES.en).daysNarrow[weekdayIndex];
}

export function fmtWeekdayShort(locale: Locale, weekdayIndex: number) {
  return (NAMES[locale] ?? NAMES.en).daysShort[weekdayIndex];
}

/** Formats an instant in the user's timezone, e.g. "18:42". */
export function fmtTime(locale: Locale, instant: Date | string, timeZone: string) {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return new Intl.DateTimeFormat(intlLocale(locale), { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(d);
}

export function fmtRelativeDays(locale: Locale, days: number) {
  return new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" }).format(days, "day");
}

/** Formatter bound to a locale and unit system (server: getUserContext().fmt, client: useFmt()). */
export function createFormatter(locale: Locale, units: UnitSystem) {
  return {
    locale,
    units,
    number: (v: number, decimals = 0, opts?: { min?: number; signed?: boolean }) => fmtNumber(locale, v, decimals, opts),
    int: (v: number) => fmtInt(locale, v),
    pct: (fraction: number, decimals = 0) => fmtPercent(locale, fraction, decimals),
    weight: (kg: number, opts?: { decimals?: number; unit?: boolean; signed?: boolean }) => fmtWeight(locale, units, kg, opts),
    load: (kg: number, unit = true) => fmtLoad(locale, units, kg, unit),
    length: (cm: number, opts?: { decimals?: number; signed?: boolean }) => fmtLength(locale, units, cm, opts),
    distance: (m: number, decimals = 2) => fmtDistance(locale, units, m, decimals),
    volume: (ml: number) => fmtVolume(locale, units, ml),
    kcal: (kcal: number, unit = true) => fmtKcal(locale, kcal, unit),
    grams: (g: number, decimals = 0) => fmtGrams(locale, g, decimals),
    date: (iso: ISODate, style: DateStyle = "medium") => fmtDate(locale, iso, style),
    weekdayShort: (i: number) => fmtWeekdayShort(locale, i),
    weekdayNarrow: (i: number) => fmtWeekdayNarrow(locale, i),
    duration: fmtDurationShort,
    clock: fmtClock,
    sleep: fmtSleep,
    pace: (secondsPerUnit: number | null) => fmtPace(secondsPerUnit, units),
    time: (instant: Date | string, timeZone: string) => fmtTime(locale, instant, timeZone),
    relativeDays: (days: number) => fmtRelativeDays(locale, days),
    weightUnit: weightUnit(units),
    lengthUnit: lengthUnit(units),
    distanceUnit: distanceUnit(units),
    volumeUnit: volumeUnit(units),
  };
}

export type Formatter = ReturnType<typeof createFormatter>;
