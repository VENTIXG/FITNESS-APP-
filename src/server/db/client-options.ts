import postgres from "postgres";

/**
 * Shared postgres.js client factory (used by the app and by the CLI scripts).
 *
 * Env:
 * - DATABASE_URL           postgres://user:pass@host:5432/db
 * - DATABASE_SSL           "require" | "disable" (default: driver default / URL sslmode)
 * - DATABASE_PREPARE       "false" when using a transaction-mode pooler (Supabase :6543, PgBouncer)
 * - DATABASE_POOL_MAX      max connections per instance (default 10)
 */
export function createPostgresClient(url: string, overrides: postgres.Options<Record<string, never>> = {}) {
  const ssl = process.env.DATABASE_SSL;
  return postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    prepare: process.env.DATABASE_PREPARE !== "false",
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
    ...(ssl === "require" ? { ssl: "require" as const } : ssl === "disable" ? { ssl: false } : {}),
    ...overrides,
  });
}
