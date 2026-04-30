import { sql } from "drizzle-orm";
import { db } from "../db";

export interface MatchingConfigRepository {
  getActiveMatchingConfig(): Promise<any | undefined>;
  updateMatchingConfig(config: any): Promise<any>;
  saveMatchingResult(result: any): Promise<any>;
}

export const matchingConfigRepo: MatchingConfigRepository = {
  async getActiveMatchingConfig(): Promise<any | undefined> {
    const result = await db.execute(sql`
      SELECT * FROM matching_config 
      WHERE is_active = true 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    return result.rows[0] || undefined;
  },

  async updateMatchingConfig(config: any): Promise<any> {
    await db.execute(sql`
      UPDATE matching_config SET is_active = false
    `);

    const result = await db.execute(sql`
      INSERT INTO matching_config (
        config_name, 
        personality_weight, 
        interests_weight, 
        intent_weight, 
        background_weight, 
        culture_weight,
        min_group_size,
        max_group_size,
        preferred_group_size,
        max_same_archetype_ratio,
        min_chemistry_score,
        is_active,
        notes,
        created_by
      ) VALUES (
        ${config.configName || "default"},
        ${config.personalityWeight || 30},
        ${config.interestsWeight || 25},
        ${config.intentWeight || 20},
        ${config.backgroundWeight || 15},
        ${config.cultureWeight || 10},
        ${config.minGroupSize || 5},
        ${config.maxGroupSize || 10},
        ${config.preferredGroupSize || 7},
        ${config.maxSameArchetypeRatio || 40},
        ${config.minChemistryScore || 60},
        true,
        ${config.notes || null},
        ${config.createdBy || null}
      )
      RETURNING *
    `);
    return result.rows[0];
  },

  async saveMatchingResult(result: any): Promise<any> {
    const userIdsArray = result.userIds || [];
    const userIdsParam =
      userIdsArray.length === 0
        ? sql`ARRAY[]::text[]`
        : sql`ARRAY[${sql.join(userIdsArray.map((id: string) => sql`${id}`), sql.raw(", "))}]::text[]`;

    const insertResult = await db.execute(sql`
      INSERT INTO matching_results (
        event_id,
        config_id,
        user_ids,
        user_count,
        groups,
        group_count,
        avg_chemistry_score,
        avg_diversity_score,
        overall_match_quality,
        execution_time_ms,
        is_test_run,
        notes
      ) VALUES (
        ${result.eventId || null},
        ${result.configId || null},
        ${userIdsParam},
        ${result.userCount || 0},
        ${JSON.stringify(result.groups || [])}::jsonb,
        ${result.groupCount || 0},
        ${result.avgChemistryScore || 0},
        ${result.avgDiversityScore || 0},
        ${result.overallMatchQuality || 0},
        ${result.executionTimeMs || 0},
        ${result.isTestRun || false},
        ${result.notes || null}
      )
      RETURNING *
    `);
    return insertResult.rows[0];
  },
};
