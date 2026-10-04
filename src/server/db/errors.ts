import { MissingDatabaseError } from "./index";

const CONNECTION_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ECONNRESET",
  "CONNECT_TIMEOUT",
  "28P01", // invalid password
  "28000", // invalid authorization
  "3D000", // database does not exist
  "42P01", // relation does not exist → migrations not applied
  "57P03", // cannot connect now
]);

/** True for configuration/connectivity problems (as opposed to bugs or bad input). */
export function isDatabaseUnavailable(err: unknown): boolean {
  let e: unknown = err;
  for (let i = 0; i < 5 && e; i++) {
    if (e instanceof MissingDatabaseError) return true;
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string" && CONNECTION_CODES.has(code)) return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}
