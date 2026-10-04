/**
 * Unit conversion. All data is stored in metric (kg, cm, ml, metres); these helpers
 * convert at the UI boundary according to the user's unit system.
 */
import type { UnitSystem } from "./domain";

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;
export const ML_PER_FL_OZ = 29.5735295625;
export const M_PER_MI = 1609.344;
export const G_PER_OZ = 28.349523125;

export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const cmToIn = (cm: number) => cm / CM_PER_IN;
export const inToCm = (inches: number) => inches * CM_PER_IN;
export const mlToFlOz = (ml: number) => ml / ML_PER_FL_OZ;
export const flOzToMl = (oz: number) => oz * ML_PER_FL_OZ;
export const gToOz = (g: number) => g / G_PER_OZ;
export const ozToG = (oz: number) => oz * G_PER_OZ;

export function weightUnit(system: UnitSystem) {
  return system === "imperial" ? "lb" : "kg";
}
export function lengthUnit(system: UnitSystem) {
  return system === "imperial" ? "in" : "cm";
}
export function distanceUnit(system: UnitSystem) {
  return system === "imperial" ? "mi" : "km";
}
export function volumeUnit(system: UnitSystem) {
  return system === "imperial" ? "fl oz" : "ml";
}

export function toDisplayWeight(kg: number, system: UnitSystem) {
  return system === "imperial" ? kgToLb(kg) : kg;
}
export function fromDisplayWeight(value: number, system: UnitSystem) {
  return system === "imperial" ? lbToKg(value) : value;
}
export function toDisplayLength(cm: number, system: UnitSystem) {
  return system === "imperial" ? cmToIn(cm) : cm;
}
export function fromDisplayLength(value: number, system: UnitSystem) {
  return system === "imperial" ? inToCm(value) : value;
}
/** metres → km or miles */
export function toDisplayDistance(m: number, system: UnitSystem) {
  return system === "imperial" ? m / M_PER_MI : m / 1000;
}
/** km or miles → metres */
export function fromDisplayDistance(value: number, system: UnitSystem) {
  return system === "imperial" ? value * M_PER_MI : value * 1000;
}
export function toDisplayVolume(ml: number, system: UnitSystem) {
  return system === "imperial" ? mlToFlOz(ml) : ml;
}
export function fromDisplayVolume(value: number, system: UnitSystem) {
  return system === "imperial" ? flOzToMl(value) : value;
}
/** km/h → mph when imperial */
export function toDisplaySpeed(kmh: number, system: UnitSystem) {
  return system === "imperial" ? (kmh * 1000) / M_PER_MI : kmh;
}
export function fromDisplaySpeed(value: number, system: UnitSystem) {
  return system === "imperial" ? (value * M_PER_MI) / 1000 : value;
}

/** Seconds per km (metric) or per mile (imperial); null when distance is missing. */
export function paceSeconds(durationSeconds: number, distanceM: number | null | undefined, system: UnitSystem) {
  if (!distanceM || distanceM <= 0 || durationSeconds <= 0) return null;
  const units = toDisplayDistance(distanceM, system);
  return durationSeconds / units;
}

/** Round a weight to the nearest loadable increment (in kg). */
export function roundToIncrement(kg: number, incrementKg: number) {
  if (incrementKg <= 0) return kg;
  return Math.round(kg / incrementKg) * incrementKg;
}

/** Height in feet+inches for imperial display. */
export function cmToFeetInches(cm: number) {
  const totalIn = cmToIn(cm);
  let feet = Math.floor(totalIn / 12);
  let inches = Math.round(totalIn - feet * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
}
