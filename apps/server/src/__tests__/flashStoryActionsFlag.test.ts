import { describe, expect, it } from "vitest";

import { DEFAULT_FLAG_VALUES, FLAG_ENV_MAP } from "../lib/featureFlags";

/**
 * 叙事动作层开关注册契约（sprint_20260821_3kmkkw, AC-07/SEC-01）：
 * 键一旦进入 FLAG_ENV_MAP，admin /api/admin/feature-flags 路由的
 * VALID_FLAG_KEYS 白名单（super_admin + FEATURE_FLAG_UPDATED 审计）即自动覆盖它。
 */
describe("flashStoryActionsEnabled flag registration", () => {
  it("is DB-backed with the FLASH_STORY_ACTIONS_ENABLED env fallback", () => {
    expect(FLAG_ENV_MAP.flashStoryActionsEnabled).toBe("FLASH_STORY_ACTIONS_ENABLED");
  });

  it("ships dark: explicit default false when neither DB row nor env var is set", () => {
    expect(DEFAULT_FLAG_VALUES.flashStoryActionsEnabled).toBe(false);
  });

  it("keeps neighboring flash flags untouched", () => {
    expect(FLAG_ENV_MAP.flashStoryV2Enabled).toBe("FLASH_STORY_V2_ENABLED");
    expect(DEFAULT_FLAG_VALUES.flashStoryV2Enabled).toBe(true);
    expect(FLAG_ENV_MAP.flashStoryAiResponsesEnabled).toBe("FLASH_STORY_AI_RESPONSES_ENABLED");
    expect(DEFAULT_FLAG_VALUES.flashStoryAiResponsesEnabled).toBe(false);
  });
});
