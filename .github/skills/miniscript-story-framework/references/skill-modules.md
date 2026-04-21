# Callable units (MiniScript Story)

| Unit | Role | Notes |
|------|------|-------|
| `generatePremise` | **LLM** (when `SOCIAL_MINISCRIPT_LLM_ENABLED`) **or** deterministic stub | Routed via `getClientForFunction('generateMiniScriptFramework')` (DeepSeek `json_object`); Zod + host authority in `apps/server/src/lib/miniscriptAgent.ts`. |
| `assignSins` | Deterministic hooks (stub path) | Map to `sinHook` strings; keep playful, non-harmful. |
| `buildActFlow` | Structured beats (stub path) | 2–4 acts; each act has `beats[]`. |
| `composeEnding` | Resolution + mechanic (stub path) | Maps to `ending.resolutionSummary` + `ending.confessionMechanic`. |
| **Master** | `generateMiniScriptFramework` / `generateMiniScriptFrameworkWithMeta` | Orchestrator: optional model → `miniScriptStoryFrameworkSchema` → curated stub; single `logAITrace` per request (`domain: 'miniscript'`). |

**Runtime flags:** `SOCIAL_MINISCRIPT_LLM_ENABLED=true` opts into the model path; otherwise the deterministic stub runs (still schema-valid, still traced with `errorCode: 'llm_disabled'`).

**Idempotency:** `POST /api/miniscript/generate` returns `200` + existing `miniScriptFramework` when already set (no second LLM call, no overwrite).

Tests: `miniscriptAgent.test.ts` (valid / invalid / fallback), `miniscriptRoutes.test.ts` (host-only, idempotent repeat POST), `miniscriptGenerateAndPoll.test.ts` (generate then GET social session).

**Artifacts:** Legacy phase id `mini_script_beta` is migrated at read time in `packages/shared/src/socialIcebreaker.ts`; no remaining fixtures or seeds in-repo (grep `mini_script_beta` outside that file returns nothing).
