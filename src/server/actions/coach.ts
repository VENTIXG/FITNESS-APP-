"use server";

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { addDays, startOfWeek } from "@/lib/dates";
import { format } from "@/lib/i18n";
import { getAnalysis } from "@/server/queries/analysis";
import { getWeeklyReport } from "@/server/queries/reports";
import { ActionError, createAction } from "./_lib";

const DEFAULT_MODEL = "claude-opus-5-5";
/** Models that accept the server-side refusal fallback ("default" routing). */
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

/** Simple per-user throttle (per server instance) so a stuck button can't run up costs. */
const recent = new Map<string, number[]>();
const LIMIT = 10;
const WINDOW_MS = 60 * 60 * 1000;

export async function isAiCoachConfigured() {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

const SYSTEM = `You write a short weekly check-in for the owner of a private fitness tracking app, based only on the aggregated numbers you are given.

Rules:
- Interpret the data plainly and specifically: what went well, what changed, and one or two practical, behaviour-level things to consider next week (logging consistency, protein, steps, training frequency, sleep).
- Never diagnose, never mention medical conditions, medications or supplements dosing, and never give medical advice. If something looks unusual, suggest talking to a qualified professional rather than speculating.
- Never encourage extreme deficits, very fast weight loss, or rates faster than about 1% of body weight per week. Do not present forecasts as guaranteed.
- Treat days without logs as unknown, not as zero. If data is sparse, say the conclusions are tentative.
- 120-200 words, no headings, at most 4 short bullet points. Use the requested language and the units given.`;

export const generateCoachSummary = createAction(
  z.object({}),
  async (_input, ctx) => {
    if (!(await isAiCoachConfigured())) throw new ActionError("not_configured");
    const now = Date.now();
    const hits = (recent.get(ctx.userId) ?? []).filter((t) => now - t < WINDOW_MS);
    if (hits.length >= LIMIT) throw new ActionError("rate_limited");
    recent.set(ctx.userId, [...hits, now]);

    const thisWeek = startOfWeek(ctx.today, ctx.weekStartsOn);
    const [current, previous, analysis] = await Promise.all([
      getWeeklyReport(ctx, thisWeek),
      getWeeklyReport(ctx, addDays(thisWeek, -7)),
      getAnalysis(ctx),
    ]);
    const strip = (r: typeof current) => {
      const { days: _days, reflection: _r, rating: _rt, ...rest } = r;
      void _days;
      void _r;
      void _rt;
      return rest;
    };
    const { t, fmt, locale } = ctx;
    const payload = {
      language: locale === "el" ? "Greek" : "English",
      units: { weight: fmt.weightUnit, energy: "kcal", distance: fmt.distanceUnit },
      today: ctx.today,
      primaryGoal: ctx.profile.primaryGoal,
      goal: analysis.goal ? { startWeightKg: analysis.goal.startWeightKg, targetWeightKg: analysis.goal.targetWeightKg, targetDate: analysis.goal.targetDate } : null,
      weightTrend: { currentKg: analysis.energy.stats.current, ratePerWeekKg: analysis.energy.stats.ratePerWeek },
      expenditure: {
        formulaKcal: analysis.energy.formula ? Math.round(analysis.energy.formula.tdee) : null,
        dataDrivenKcal: analysis.energy.adaptive ? Math.round(analysis.energy.adaptive.tdee) : null,
        confidence: analysis.energy.adaptive?.confidence ?? null,
      },
      thisWeekSoFar: strip(current),
      lastWeek: strip(previous),
      ruleBasedObservations: analysis.insights.map((i) => format(t.coach.i[i.id], i.params, locale)),
    };

    const client = new Anthropic();
    const model = process.env.AI_COACH_MODEL || DEFAULT_MODEL;
    const useFallback = FALLBACK_MODELS.has(model);
    try {
      const response = await client.beta.messages.create({
        model,
        max_tokens: 16000,
        system: SYSTEM,
        output_config: { effort: "medium" },
        ...(useFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        messages: [{ role: "user", content: `Here are my aggregated numbers as JSON. Write my weekly check-in.\n\n${JSON.stringify(payload)}` }],
      });
      if (response.stop_reason === "refusal") throw new ActionError("ai_error");
      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (!text) throw new ActionError("ai_error");
      return { text, model: response.model };
    } catch (err) {
      if (err instanceof ActionError) throw err;
      if (err instanceof Anthropic.RateLimitError) throw new ActionError("rate_limited");
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) throw new ActionError("not_configured");
      if (err instanceof Anthropic.APIError) {
        console.error("AI coach request failed", err.status, err.message);
        throw new ActionError("ai_error");
      }
      console.error("AI coach request failed", err);
      throw new ActionError("ai_error");
    }
  },
  { revalidate: false },
);
