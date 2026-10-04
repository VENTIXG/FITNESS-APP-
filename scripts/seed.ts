/**
 * Demo data.
 *
 *   pnpm db:seed                      → creates/refreshes the demo account (demo@forge.local)
 *   pnpm db:seed --email you@x.com    → adds demo data to an existing account (tagged, removable)
 *   pnpm db:seed --remove --email …   → removes demo-tagged rows from an account
 *
 * The demo account is flagged `is_demo_account`, so it never counts as the owner and
 * never blocks the first real sign-up.
 */
import "./load-env";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { todayInTimeZone } from "../src/lib/dates";
import { syncBuiltinCatalog } from "../src/server/catalog/sync";
import { hashPassword } from "../src/server/auth/crypto";
import { createPostgresClient } from "../src/server/db/client-options";
import * as schema from "../src/server/db/schema";
import { createDefaultHabits } from "../src/server/services/defaults";
import { generateDemoData, removeDemoData } from "../src/server/services/demo";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? (process.argv[i + 1] ?? "") : undefined;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = createPostgresClient(url, { max: 1 });
  const db = drizzle(client, { schema, casing: "snake_case" });
  try {
    await syncBuiltinCatalog(db);
    const targetEmail = arg("email")?.toLowerCase();
    const remove = process.argv.includes("--remove");

    if (targetEmail) {
      const user = (await db.select().from(schema.users).where(eq(sql`lower(${schema.users.email})`, targetEmail)).limit(1))[0];
      if (!user) throw new Error(`No account with email ${targetEmail}`);
      const profile = (await db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id)).limit(1))[0];
      await db.transaction(async (tx) => {
        await removeDemoData(tx, user.id);
        if (!remove) await generateDemoData(tx, user.id, todayInTimeZone(profile?.timezone ?? "UTC"));
      });
      console.log(remove ? `✓ Removed demo data from ${targetEmail}` : `✓ Added demo data to ${targetEmail}`);
      return;
    }

    const email = (process.env.DEMO_EMAIL ?? "demo@forge.local").toLowerCase();
    const password = process.env.DEMO_PASSWORD ?? "forge-demo-2026";
    const timezone = process.env.DEMO_TIMEZONE ?? "Europe/Athens";
    const existing = (await db.select().from(schema.users).where(eq(sql`lower(${schema.users.email})`, email)).limit(1))[0];
    if (existing && !existing.isDemoAccount) throw new Error(`${email} belongs to a real account — refusing to overwrite it.`);
    if (existing) await db.delete(schema.users).where(eq(schema.users.id, existing.id));

    await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(schema.users)
        .values({ email, passwordHash: await hashPassword(password), isDemoAccount: true })
        .returning({ id: schema.users.id });
      await tx.insert(schema.profiles).values({
        userId: user.id,
        displayName: "Alex",
        sex: "male",
        birthDate: "1992-05-14",
        heightCm: 180,
        activityLevel: "moderate",
        primaryGoal: "lose_fat",
        trainingDaysPerWeek: 4,
        timezone,
        locale: process.env.DEMO_LOCALE === "el" ? "el" : "en",
        onboardingCompletedAt: new Date(),
      });
      await tx.insert(schema.userPreferences).values({ userId: user.id });
      await createDefaultHabits(tx, user.id, "en", 4);
      await generateDemoData(tx, user.id, todayInTimeZone(timezone));
    });
    console.log(`✓ Demo account ready\n  email:    ${email}\n  password: ${password}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
