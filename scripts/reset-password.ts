/**
 * Reset a user's password from the server shell (no email flow by design).
 *   pnpm db:reset-password you@example.com
 * The new password is read from stdin (not echoed to shell history).
 */
import "./load-env";
import { createInterface } from "node:readline/promises";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { createPostgresClient } from "../src/server/db/client-options";
import * as schema from "../src/server/db/schema";
import { hashPassword } from "../src/server/auth/crypto";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Usage: pnpm db:reset-password <email>");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const password = (await rl.question("New password (min 10 chars): ")).trim();
  rl.close();
  if (password.length < 10) throw new Error("Password must be at least 10 characters.");
  const client = createPostgresClient(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(client, { schema, casing: "snake_case" });
  const user = (await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1))[0];
  if (!user) throw new Error(`No user with email ${email}`);
  await db.update(schema.users).set({ passwordHash: await hashPassword(password) }).where(eq(schema.users.id, user.id));
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, user.id));
  console.log("Password updated; all sessions signed out.");
  await client.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
