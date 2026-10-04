import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { createPostgresClient } from "./client-options";

export type Database = PostgresJsDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Either the root database or an open transaction. */
export type DbOrTx = Database | Transaction;

export class MissingDatabaseError extends Error {
  constructor() {
    super("DATABASE_URL is not configured. Copy .env.example to .env and set it.");
    this.name = "MissingDatabaseError";
  }
}

type Cached = { client: postgres.Sql; db: Database };
const globalForDb = globalThis as unknown as { __forgeDb?: Cached };

function init(): Cached {
  if (globalForDb.__forgeDb) return globalForDb.__forgeDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new MissingDatabaseError();
  const client = createPostgresClient(url);
  const db = drizzle(client, { schema, casing: "snake_case" });
  const cached = { client, db };
  // Reuse the pool across hot reloads in development and across invocations in a warm runtime.
  globalForDb.__forgeDb = cached;
  return cached;
}

/**
 * Lazily-initialised database handle. Created on first use so `next build`
 * never needs a database connection.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    const real = init().db;
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
