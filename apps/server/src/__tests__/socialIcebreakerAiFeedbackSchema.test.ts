import { describe, expect, it } from "vitest";
import { submitSocialIcebreakerAiFeedbackSchema } from "@shared/schema";

describe("submitSocialIcebreakerAiFeedbackSchema", () => {
  it("accepts valid payload", () => {
    const parsed = submitSocialIcebreakerAiFeedbackSchema.safeParse({
      phase: "recap",
      promptVersion: "social-recap-summary-v2",
      aiCorrelationId: "550e8400-e29b-41d4-a716-446655440000",
      rating: "helpful",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects bad uuid", () => {
    const parsed = submitSocialIcebreakerAiFeedbackSchema.safeParse({
      phase: "recap",
      promptVersion: "social-recap-summary-v2",
      aiCorrelationId: "not-a-uuid",
      rating: "neutral",
    });
    expect(parsed.success).toBe(false);
  });
});
