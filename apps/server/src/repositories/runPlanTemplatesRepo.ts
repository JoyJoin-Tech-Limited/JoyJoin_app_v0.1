// Run Plan Templates Repository — DB queries for template-driven compiler

import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { runPlanTemplates } from "@shared/schema";
import type { RunPlanTemplateRow } from "@shared/schema";

export async function getTemplateByVibeAndTier(
  vibe: string,
  tier: string,
): Promise<RunPlanTemplateRow | undefined> {
  const [row] = await db
    .select()
    .from(runPlanTemplates)
    .where(and(eq(runPlanTemplates.vibe, vibe), eq(runPlanTemplates.tier, tier)))
    .limit(1);
  return row;
}
