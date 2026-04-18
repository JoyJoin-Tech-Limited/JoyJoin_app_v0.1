# AI prompt version registry (server)

**Convention:** Bump the version string whenever prompt text, schema, or evaluator rules change for that feature. Clients may receive `promptVersion` on responses (e.g. `GroupAnalysisResponse`, `ProfileTaglineResponse`).

Sources of truth are the **const** in each service file below.

## Social Icebreaker (`socialIcebreakerAIService.ts`)

| Prompt ID | Constant |
|-----------|----------|
| `social-warmup-topics-v1` | `WARMUP_TOPICS_PROMPT_VERSION` |
| `social-micro-challenges-v1` | `MICRO_CHALLENGES_PROMPT_VERSION` |
| `social-lie-detective-v1` | `LIE_DETECTIVE_PROMPT_VERSION` |
| `social-recap-summary-v1` | `RECAP_SUMMARY_PROMPT_VERSION` |
| `social-personality-dice-v1` | `PERSONALITY_DICE_PROMPT_VERSION` |

## Onboarding tagline (`profileTaglineService.ts`)

| Prompt ID | Constant |
|-----------|----------|
| `profile-tagline-v1` | `PROMPT_VERSION` |

## Event theme title (`eventThemeTitleGenerator.ts` / traces)

| Prompt ID | Notes |
|-----------|--------|
| `event-theme-title-v1` | Used in trace tests and generation pipeline |

## Match intelligence (`matchExplanationService.ts`)

Pair/group explanations use version tags inside the service (search for `promptVersion` / version constants in that file). Extend **here** before adding parallel orchestrators.

## Semantic profile document (`userSemanticProfileService.ts`)

| Generator version | Notes |
|-------------------|--------|
| `semantic-profile-v1` | Document builder + embedding pipeline (not an LLM chat prompt). |

---

When adding a new AI feature, add a row to this table in the same PR as the code change.
