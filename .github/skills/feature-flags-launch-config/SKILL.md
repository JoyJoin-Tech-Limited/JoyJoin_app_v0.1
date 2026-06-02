---
name: feature-flags-launch-config
description: >-
  JoyJoin feature flags, launch configuration, and safe rollout patterns.
  Covers env-var feature gates, startup validation, client exposure via /api/auth/user,
  kill-switch semantics, and rollout/rollback discipline. Use when adding, changing,
  or auditing a feature flag; when planning a staged rollout; or when launch config
  docs and env examples need updating. Trigger phrases: "feature flag", "kill switch",
  "launch config", "roll out behind a flag", "PAYMENTS_ENABLED", "safe rollout",
  "rollback a feature".
---

# feature-flags-launch-config

**Core rule:** Every env-gated feature must have a clear default. Defaults must be safe (off or degraded) for production. Startup validation fails closed. Feature flags are server-side truth; the client never invents its own flag state. AI feature flags must have deterministic fallbacks when disabled.

## When to use this skill

- Adding a new feature flag or changing an existing flag's semantics
- Planning a staged rollout or kill-switch response
- Auditing whether a feature is correctly gated and degrades gracefully
- Updating `docs/LAUNCH_CONFIG.md`, `docs/ai-feature-flags.md`, or env example files
- Exposing a server-side flag to the client via `/api/auth/user`

## When NOT to use this skill

- Task is about implementing the feature itself (use the domain skill for that feature)
- Task is purely about auth policy or RBAC (use `auth-session-and-safety-boundaries`)
- Task is about adding an LLM call safely (use `llm-runtime-safety-and-integration`)
- Task is about code review with no feature-flag focus (use `code-review`)

## Active feature flags (overview)

### DB-backed kill switches (admin-toggleable, 2026-05-24)

These 5 flags are resolved via `apps/server/src/lib/featureFlags.ts` (DB source of truth → env fallback → 5s cache). Admin portal `/admin/feature-flags` (super_admin only) exposes toggle UI with `updatedBy` audit.

| Flag key | Env fallback | Purpose |
|----------|-------------|---------|
| `restartOnboarding` | `RESTART_ONBOARDING_ENABLED` | Onboarding restart v0.1 welcome-back screen |
| `smartProfession` | `SMART_PROFESSION_V1_ENABLED` | AI profession classification overlay |
| `onboardingForceSkip` | `ONBOARDING_FORCE_SKIP_ENABLED` | Admin force-skip button on onboarding steps |
| `matchingLiveReveal` | `MATCHING_LIVE_REVEAL_ENABLED` | Live reveal overlay on matching status |
| `socialIcebreakerClientForceEnd` | `SOCIAL_ICEBREAKER_CLIENT_FORCE_END` | Host emergency end button in icebreaker |

### Env-only feature gates

| Category | Key flags |
|----------|-----------|
| Payments | `PAYMENTS_ENABLED` |
| Matching | `ENABLE_SEMANTIC_SIMILARITY` |
| Social Icebreaker | `SOCIAL_ICEBREAKER_ENABLE_AUCTION`, `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT`, `SOCIAL_ICEBREAKER_ENABLE_PERSONALITY_DICE`, `PERSONALITY_DICE_CHOOSE_MODE_ENABLED` |
| AI / creative | `ENABLE_EVENT_THEME_TITLE_GENERATION`, `AI_USAGE_TRACKING_ENABLED` |
| Auth / debug | `ENABLE_DEV_AUTH_TOOLS`, `DEBUG_AUTH`, `ALLOW_PRODUCTION_AUTH_DEBUG` (non-production only) |

**Kill switches** reject requests early with a machine-readable `code` (e.g., `PAYMENTS_DISABLED`) before touching external APIs or the database.

For rollout patterns, startup validation details, client exposure specifics, and staged rollout examples — see [references/config-guide.md](references/config-guide.md).

## Quick examples

- **Add a new DB-backed kill switch:** Add key+env mapping to `lib/featureFlags.ts` `FLAG_ENV_MAP` → add default env var to `.env.example` → gate logic via `await getFeatureFlag(key)` → add admin route entry if toggleable → expose via `buildAuthUserResponse.ts` if client needs it → add tests for both paths.
- **Add a new env-only feature flag:** Add env read → gate logic → document in `docs/LAUNCH_CONFIG.md` → add to `.env.example` → expose via `/api/auth/user` if client needs it → add tests for both paths.
- **Kill-switch a payment incident:** Set `PAYMENTS_ENABLED=false` → verify `/api/readyz` returns `200` → confirm `POST /api/payments/create` returns `503` with `code: "PAYMENTS_DISABLED"` → confirm client shows maintenance message.
- **Safely roll out `ENABLE_SEMANTIC_SIMILARITY`:** Enable in staging → run matching stress simulation → monitor `joyjoin_matching_semantic_similarity_score` and `joyjoin_matching_semantic_pair_score_delta` in `/api/metrics` → enable in production during a low-traffic window.
- **Expose a flag to the client:** Add the boolean to `AuthUserResponse` in `apps/server/src/routes/domains/auth.ts` and to `packages/shared/src/api.ts`. Client hooks should read from the server response, never from a local env var.

## Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| Feature works locally but not in production | The flag may be unset in production, or the default differs. Check `docs/LAUNCH_CONFIG.md` and deployed env values. |
| Payment routes return 503 after deploy | `PAYMENTS_ENABLED` is `false` or a required `WECHAT_PAY_*` var is missing when `PAYMENTS_ENABLED=true`. Check `/api/readyz`. |
| Semantic similarity scores look wrong | Verify `ENABLE_SEMANTIC_SIMILARITY` is `true`. Check `joyjoin_matching_semantic_feature_enabled` gauge in `/api/metrics`. |
| Auction lots are generic instead of AI-generated | `SOCIAL_AUCTION_LLM_ENABLED` is unset/false. This is the expected fallback. Set to `true` to enable model generation. |
| MiniScript phase is missing | Check `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT` (or legacy `_BETA` alias). Also verify `SOCIAL_ICEBREAKER_ENABLE_PERSONALITY_DICE` is not `false` in a way that changes phase ordering unexpectedly. |
| Client shows payment UI when payments are disabled | The client is not reading `paymentsEnabled` from `/api/auth/user`. Never gate client UI on a client-side env var. |
| Feature flag removed but code still references it | The flag was retired without updating all call sites. Search for the old env var name across the codebase and replace with the new default behavior. |

## Review checklist

- [ ] New flag has a safe default and is documented in `docs/LAUNCH_CONFIG.md` or `docs/ai-feature-flags.md`
- [ ] Env example files include the new var
- [ ] Startup validation in `configValidation.ts` handles cross-field constraints if applicable
- [ ] Flag is read server-side; the client receives it through an API response, not a local env var
- [ ] Disabled path degrades gracefully (clear error code, deterministic fallback, or maintenance UI)
- [ ] Both enabled and disabled paths have test coverage
- [ ] Related Prometheus metrics or admin dashboard panels are updated if the flag affects product behavior
- [ ] Legacy alias or old flag name is quarantined (not promoted as active) if one exists
- [ ] AI feature flags have deterministic fallbacks when disabled (curated lots, stub framework, or template fallback)
