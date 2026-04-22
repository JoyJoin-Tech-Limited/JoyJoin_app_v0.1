---
name: feature-flags-launch-config
description: >-
  JoyJoin feature flags, launch configuration, and safe rollout patterns.
  Covers env-var feature gates (payments, matching, icebreaker phases, AI surfaces,
  auth/debug), startup validation, client exposure via /api/auth/user, kill-switch
  semantics, and rollout/rollback discipline. Use when adding, changing, or auditing
  a feature flag; when planning a staged rollout; or when launch config docs and
  env examples need updating. Trigger phrases: "feature flag", "kill switch",
  "launch config", "roll out behind a flag", "PAYMENTS_ENABLED", "ENABLE_SEMANTIC_SIMILARITY",
  "SOCIAL_ICEBREAKER_ENABLE_AUCTION", "toggle a feature", "env feature gate",
  "safe rollout", "rollback a feature".
---

# feature-flags-launch-config

## Purpose

This skill owns how JoyJoin gates product behavior through environment variables:
which flags exist, what they control, their default values, how they are validated
at startup, how they are exposed to clients, and the operational rules for rolling
them out or rolling them back without a code deploy.

## When to use this skill

Use this skill when you are:

- adding a new feature flag or changing an existing flag's semantics
- planning a staged rollout (e.g., enable a flag in staging before production)
- auditing whether a feature is correctly gated, has a kill switch, or degrades gracefully
- updating `docs/LAUNCH_CONFIG.md`, `docs/ai-feature-flags.md`, or env example files
- exposing a server-side flag to the client via `/api/auth/user` or a dedicated config endpoint
- writing a runbook that mentions toggling a feature flag for incident response

## When NOT to use this skill

- task is about implementing the feature itself (use the domain skill for that feature)
- task is purely about auth policy or RBAC (use `auth-session-and-safety-boundaries`)
- task is about adding an LLM call safely (use `llm-runtime-safety-and-integration`)
- task is about code review with no feature-flag focus (use `code-review`)

## Core rules

1. **Every env-gated feature must have a clear default.**
   Document the default in code, in `docs/LAUNCH_CONFIG.md` or `docs/ai-feature-flags.md`,
   and in env example files. Defaults must be safe (off or degraded) for production.

2. **Startup validation must fail closed.**
   `apps/server/src/lib/configValidation.ts` validates required vars and cross-field
   constraints (e.g., `PAYMENTS_ENABLED=true` requires all `WECHAT_PAY_*` vars).
   In production, missing required config causes `process.exit(1)`; in non-production
   it emits warnings.

3. **Feature flags are server-side truth.**
   The client never invents its own flag state. If the client needs to know a flag,
   the server exposes it (e.g., `paymentsEnabled` in `/api/auth/user`).

4. **Kill switches reject requests early.**
   When a flag disables a subsystem (e.g., `PAYMENTS_ENABLED=false`), routes must
   return a clear error with a machine-readable `code` (e.g., `PAYMENTS_DISABLED`)
   before touching external APIs or the database.

5. **AI feature flags must have deterministic fallbacks.**
   When an LLM-gated flag is off, the system must still produce a valid, schema-compliant
   result (curated fallback lots, deterministic stub framework, or template fallback title).
   Never leave a user-facing flow broken because an AI flag is disabled.

6. **Preserve backward compatibility when removing flags.**
   If a flag is being retired, ensure the enabled behavior is the new default,
   update docs, and remove the env var from example files in the same PR.

## Active feature flags

### Payments
| Flag | Default | Controls |
|------|---------|----------|
| `PAYMENTS_ENABLED` | `false` | Payment creation routes; client payment UI. |

### Matching
| Flag | Default | Controls |
|------|---------|----------|
| `ENABLE_SEMANTIC_SIMILARITY` | `false` | 7th pair-scoring dimension (semantic similarity). When `false`, 6D weights are used unchanged. |

### Social Icebreaker phases
| Flag | Default | Controls |
|------|---------|----------|
| `SOCIAL_ICEBREAKER_ENABLE_AUCTION` | `false` | Inserts `auction` phase before `personality_dice`. |
| `SOCIAL_AUCTION_LLM_ENABLED` | `false` | When `true`, auction lots are model-generated; otherwise curated fallback lots. |
| `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT` | `false` | Appends `mini_script` phase before recap. Legacy alias: `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT_BETA`. |
| `SOCIAL_MINISCRIPT_LLM_ENABLED` | `false` | When `true`, MiniScript framework is LLM-generated; otherwise deterministic stub. |
| `SOCIAL_ICEBREAKER_ENABLE_PERSONALITY_DICE` | `true` | Includes `personality_dice` phase. Set `false` to remove it. |

### AI / creative
| Flag | Default | Controls |
|------|---------|----------|
| `ENABLE_EVENT_THEME_TITLE_GENERATION` | `true` | Async AI-generated event theme titles. Set `false` to disable. |
| `AI_USAGE_TRACKING_ENABLED` | `true` | Extra logging for event-theme AI usage. |

### Auth / debug (non-production only)
| Flag | Default | Controls |
|------|---------|----------|
| `ENABLE_DEV_AUTH_TOOLS` | unset | Dev/test auth helper routes (bypass login, mock WeChat). Hard-disabled in production regardless of value. |
| `DEBUG_AUTH` | unset | Verbose auth debug logging. Only active in non-production. |
| `ALLOW_PRODUCTION_AUTH_DEBUG` | unset | Emergency override for production auth-debug surfaces. Requires explicit `=1`. |

## Quick examples

- **Add a new feature flag:**
  1. Add the env var read in the relevant server file (e.g., `process.env.MY_FEATURE_ENABLED === 'true'`).
  2. Gate the route or service logic with a clear early return / fallback.
  3. Document the flag in `docs/LAUNCH_CONFIG.md` or `docs/ai-feature-flags.md`.
  4. Add the var (commented out or with safe default) to `.env.example` and `deployment/.env.staging.example`.
  5. If the client needs the flag, expose it in `/api/auth/user` or a dedicated config endpoint.
  6. Add a test that verifies both enabled and disabled paths.

- **Safely roll out `ENABLE_SEMANTIC_SIMILARITY`:**
  1. Confirm staging has representative pool data.
  2. Enable in staging: `ENABLE_SEMANTIC_SIMILARITY=true`.
  3. Run matching stress simulation (`npm run test:matching:stress`) and check admin dashboard
     🧠 语义匹配观测 panel for score shifts.
  4. Monitor `joyjoin_matching_semantic_similarity_score` and `joyjoin_matching_semantic_pair_score_delta`
     in `/api/metrics`.
  5. If deltas are within expected bounds, enable in production during a low-traffic window.
  6. Keep the flag for at least one full event cycle before considering permanent enable.

- **Kill-switch a payment incident:**
  1. Set `PAYMENTS_ENABLED=false` in the environment and restart the server (or redeploy).
  2. Verify `/api/readyz` still returns `200` (payment config validation skips when disabled).
  3. Confirm `POST /api/payments/create` returns `503` with `code: "PAYMENTS_DISABLED"`.
  4. Confirm the client (`BlindBoxPaymentPage`, mini-program `paymentEntry.ts`) shows the
     maintenance message instead of the payment UI.

- **Expose a flag to the client:**
  Add the boolean to the `AuthUserResponse` in `apps/server/src/routes/domains/auth.ts`
  and to `packages/shared/src/api.ts`. Client hooks (`useAuth.ts`) should read from the
  server response, never from a local env var.

## Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| **Feature works locally but not in production** | The flag may be unset in production, or the default differs. Check `docs/LAUNCH_CONFIG.md` and the actual env values in the deployed environment. |
| **Payment routes return 503 after deploy** | `PAYMENTS_ENABLED` is `false` or missing, or a required `WECHAT_PAY_*` var is missing when `PAYMENTS_ENABLED=true`. Check `/api/readyz` config errors. |
| **Semantic similarity scores look wrong** | Verify `ENABLE_SEMANTIC_SIMILARITY` is actually `true`. Check `joyjoin_matching_semantic_feature_enabled` gauge in `/api/metrics`. If `0`, the flag is off. |
| **Auction lots are generic instead of AI-generated** | `SOCIAL_AUCTION_LLM_ENABLED` is unset/false. This is the expected fallback. Set to `true` to enable model generation. |
| **MiniScript phase is missing** | Check `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT` (or legacy `_BETA` alias). Also verify `SOCIAL_ICEBREAKER_ENABLE_PERSONALITY_DICE` is not `false` in a way that changes phase ordering unexpectedly. |
| **Client shows payment UI when payments are disabled** | The client is not reading `paymentsEnabled` from `/api/auth/user`, or the server response does not include it. Never gate client UI on a client-side env var. |

## Review checklist

- [ ] New flag has a safe default and is documented in `docs/LAUNCH_CONFIG.md` or `docs/ai-feature-flags.md`
- [ ] Env example files (`.env.example`, `deployment/.env.staging.example`, `deployment/.env.production.example`) include the new var
- [ ] Startup validation in `configValidation.ts` handles cross-field constraints if applicable
- [ ] Flag is read server-side; the client receives it through an API response, not a local env var
- [ ] Disabled path degrades gracefully (clear error code, deterministic fallback, or maintenance UI)
- [ ] Both enabled and disabled paths have test coverage
- [ ] Related Prometheus metrics or admin dashboard panels are updated if the flag affects product behavior
- [ ] Legacy alias or old flag name is quarantined (not promoted as active) if one exists

## Related skills

| Skill | When to hand off |
|-------|-----------------|
| `payment-entitlement-authority` | implementing payment routes, refunds, or entitlement checks gated by `PAYMENTS_ENABLED` |
| `matching-domain` | changing scoring weights or the semantic-similarity dimension logic |
| `social-icebreaker-domain` | adding or removing icebreaker phases, session state, or host authority |
| `llm-runtime-safety-and-integration` | adding an LLM call that needs prompt versioning, fallback, or trace logging |
| `auth-session-and-safety-boundaries` | auth/debug tool gating, fail-closed policy, or production override surfaces |
| `platform-observability-and-ops` | adding metrics, alerts, or structured logging around flag state changes |
| `reliability-and-state-integrity` | multi-step rollout that needs idempotency, execution guards, or retry safety |
| `docs-sync` | updating launch docs or env examples after a flag change merges |
| `multi-agent-deliberation` | launch decisions requiring cross-perspective consensus on rollout strategy |

## Canonical references

- `docs/LAUNCH_CONFIG.md` — canonical launch configuration guide
- `docs/ai-feature-flags.md` — AI-specific feature flags and environment variables
- `apps/server/src/lib/configValidation.ts` — startup config validation
- `apps/server/src/auth/policy.ts` — auth/debug flag policy (`ENABLE_DEV_AUTH_TOOLS`, `ALLOW_PRODUCTION_AUTH_DEBUG`)
- `apps/server/src/matchingSemantic.ts` — `isSemanticSimilarityEnabled()`
- `apps/server/src/poolMatchingService.ts` — semantic similarity in matching pipeline
- `apps/server/src/socialIcebreakerPhaseConfig.ts` — icebreaker phase flag resolution
- `apps/server/src/socialIcebreakerAIService.ts` — `isAuctionLlmEnabled()`
- `apps/server/src/lib/miniscriptAgent.ts` — `isMiniscriptLlmEnabled()`
- `apps/server/src/eventThemeTitleGenerator.ts` — `ENABLE_EVENT_THEME_TITLE_GENERATION`, `AI_USAGE_TRACKING_ENABLED`
- `apps/server/src/routes/domains/payments.ts` — payment kill-switch middleware
- `apps/server/src/routes/domains/auth.ts` — `paymentsEnabled` in auth user response
- `apps/server/src/matchingMetrics.ts` — semantic similarity Prometheus metrics
- `packages/shared/src/api.ts` — shared API types including `paymentsEnabled`
