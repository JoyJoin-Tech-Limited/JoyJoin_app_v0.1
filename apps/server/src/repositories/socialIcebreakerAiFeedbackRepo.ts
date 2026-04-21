import { socialIcebreakerAiFeedback } from "@shared/schema";
import { gte } from "drizzle-orm";
import { db } from "../db";

export type SubmitIcebreakerAiFeedbackInput = {
  socialSessionId: string;
  submittedBy: string;
  phase: string;
  promptVersion: string;
  aiCorrelationId: string;
  rating: "helpful" | "neutral" | "awkward";
};

function bump(
  map: Map<string, { helpful: number; neutral: number; awkward: number }>,
  key: string,
  rating: "helpful" | "neutral" | "awkward",
) {
  const cur = map.get(key) ?? { helpful: 0, neutral: 0, awkward: 0 };
  cur[rating] += 1;
  map.set(key, cur);
}

export const socialIcebreakerAiFeedbackRepo = {
  async upsertFeedback(input: SubmitIcebreakerAiFeedbackInput): Promise<void> {
    await db
      .insert(socialIcebreakerAiFeedback)
      .values({
        socialSessionId: input.socialSessionId,
        submittedBy: input.submittedBy,
        phase: input.phase,
        promptVersion: input.promptVersion,
        aiCorrelationId: input.aiCorrelationId,
        rating: input.rating,
      })
      .onConflictDoUpdate({
        target: [
          socialIcebreakerAiFeedback.submittedBy,
          socialIcebreakerAiFeedback.socialSessionId,
          socialIcebreakerAiFeedback.phase,
          socialIcebreakerAiFeedback.aiCorrelationId,
        ],
        set: {
          rating: input.rating,
          promptVersion: input.promptVersion,
        },
      });
  },

  async getSummary(params: { since: Date }): Promise<{
    totals: { helpful: number; neutral: number; awkward: number; rows: number };
    byPhase: Array<{ phase: string; helpful: number; neutral: number; awkward: number }>;
    byPromptVersion: Array<{ promptVersion: string; helpful: number; neutral: number; awkward: number }>;
  }> {
    const rows = await db
      .select({
        phase: socialIcebreakerAiFeedback.phase,
        promptVersion: socialIcebreakerAiFeedback.promptVersion,
        rating: socialIcebreakerAiFeedback.rating,
      })
      .from(socialIcebreakerAiFeedback)
      .where(gte(socialIcebreakerAiFeedback.createdAt, params.since));

    const totals = { helpful: 0, neutral: 0, awkward: 0, rows: rows.length };
    const phaseMap = new Map<string, { helpful: number; neutral: number; awkward: number }>();
    const pvMap = new Map<string, { helpful: number; neutral: number; awkward: number }>();

    for (const r of rows) {
      const rating = r.rating as "helpful" | "neutral" | "awkward";
      totals[rating] += 1;
      bump(phaseMap, r.phase, rating);
      bump(pvMap, r.promptVersion, rating);
    }

    return {
      totals,
      byPhase: [...phaseMap.entries()].map(([phase, v]) => ({ phase, ...v })),
      byPromptVersion: [...pvMap.entries()].map(([promptVersion, v]) => ({ promptVersion, ...v })),
    };
  },
};
