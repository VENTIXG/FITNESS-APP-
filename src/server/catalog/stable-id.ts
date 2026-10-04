import { createHash } from "node:crypto";

/**
 * Deterministic UUID (RFC 4122 v5 layout) derived from a namespace + key, so the
 * built-in catalog has the same ids on every installation. This keeps backups
 * portable between instances.
 */
export function stableUuid(namespace: string, key: string): string {
  const hash = createHash("sha1").update(`forge:${namespace}:${key}`).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const builtinExerciseId = (key: string) => stableUuid("exercise", key);
export const builtinFoodId = (key: string) => stableUuid("food", key);
