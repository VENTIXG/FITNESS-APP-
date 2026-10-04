"use server";

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { requiredName, uuid } from "@/lib/validation";
import { generateToken, sha256 } from "@/server/auth/crypto";
import { db } from "@/server/db";
import { apiTokens } from "@/server/db/schema";
import { ActionError, createAction } from "./_lib";

/** Creates an ingest token. The plaintext is returned once and only its hash is stored. */
export const createApiToken = createAction(z.object({ name: requiredName(60) }), async (input, ctx) => {
  const active = await db.select({ id: apiTokens.id }).from(apiTokens).where(and(eq(apiTokens.userId, ctx.userId), isNull(apiTokens.revokedAt)));
  if (active.length >= 10) throw new ActionError("validation");
  const secret = generateToken(32);
  const token = `forge_${secret}`;
  await db.insert(apiTokens).values({ userId: ctx.userId, name: input.name, tokenHash: sha256(token), prefix: token.slice(0, 12), scopes: ["ingest"] });
  return { token };
});

export const revokeApiToken = createAction(z.object({ id: uuid }), async (input, ctx) => {
  await db.update(apiTokens).set({ revokedAt: new Date() }).where(and(eq(apiTokens.id, input.id), eq(apiTokens.userId, ctx.userId)));
  return null;
});
