import "server-only";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { addDays, type ISODate } from "@/lib/dates";
import { getUserContext, type UserContext } from "@/server/context";

/**
 * Error codes returned to the client. The UI maps them to localized messages
 * (errors.* / domain-specific keys), so nothing user-facing is built here.
 */
export type ActionErrorCode =
  | "unauthorized"
  | "validation"
  | "duplicate"
  | "not_found"
  | "conflict"
  | "in_use"
  | "unavailable"
  | "generic"
  | (string & {});

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: ActionErrorCode; fieldErrors?: Record<string, string[]> };

export class ActionError extends Error {
  constructor(
    public code: ActionErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}

/** Log dates may be at most one day ahead of the user's today (timezone/travel tolerance). */
export function assertNotFuture(date: ISODate, today: ISODate) {
  if (date > addDays(today, 1)) throw new ActionError("future_date");
}

function pgCode(err: unknown): string | undefined {
  let e: unknown = err;
  // Drizzle wraps driver errors; walk the cause chain.
  for (let i = 0; i < 4 && e && typeof e === "object"; i++) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

/**
 * Wraps a server action: authenticates, validates input with Zod, maps known
 * database errors, and never leaks internal errors to the client.
 * Server actions are public endpoints — the user id always comes from the session.
 */
export function createAction<S extends z.ZodType, R>(
  schema: S,
  handler: (input: z.output<S>, ctx: UserContext) => Promise<R>,
  options: { revalidate?: boolean } = {},
) {
  return async (raw: z.input<S>): Promise<ActionResult<R>> => {
    let ctx: UserContext;
    try {
      ctx = await getUserContext();
    } catch (err) {
      unstable_rethrow(err);
      return { ok: false, error: "unauthorized" };
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "_";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return { ok: false, error: "validation", fieldErrors };
    }
    try {
      const data = await handler(parsed.data, ctx);
      if (options.revalidate !== false) revalidatePath("/", "layout");
      return { ok: true, data };
    } catch (err) {
      unstable_rethrow(err);
      if (err instanceof ActionError) return { ok: false, error: err.code };
      const code = pgCode(err);
      if (code === "23505") return { ok: false, error: "duplicate" };
      if (code === "23503") return { ok: false, error: "in_use" };
      if (code === "23514") return { ok: false, error: "validation" };
      console.error("[action]", err);
      return { ok: false, error: "generic" };
    }
  };
}
