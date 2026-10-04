/**
 * Applies SQL migrations from ./drizzle and syncs the built-in exercise and food
 * catalogs (idempotent upserts keyed by builtin_key). Safe to run on every deploy.
 *
 *   pnpm db:migrate
 */
import "./load-env";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createPostgresClient } from "../src/server/db/client-options";
import * as schema from "../src/server/db/schema";
import { syncBuiltinCatalog } from "../src/server/catalog/sync";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env first.");
    process.exit(1);
  }
  const client = createPostgresClient(url, { max: 1 });
  const db = drizzle(client, { schema, casing: "snake_case" });
  try {
    console.log("→ Applying migrations…");
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("→ Syncing built-in catalog…");
    const result = await syncBuiltinCatalog(db);
    console.log(`  exercises: ${result.exercises}, foods: ${result.foods}`);
    console.log("✓ Database is up to date.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
