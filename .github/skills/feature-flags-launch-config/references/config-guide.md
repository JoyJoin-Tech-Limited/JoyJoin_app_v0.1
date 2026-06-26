# Feature Flags Config Guide

## Startup validation details

`apps/server/src/lib/configValidation.ts` validates required vars and cross-field constraints (e.g., `PAYMENTS_ENABLED=true` requires all `WECHAT_PAY_*` vars).
In production, missing required config causes `process.exit(1)`; in non-production it emits warnings.

## Client exposure specifics

Feature flags are server-side truth. The client never invents its own flag state. If the client needs to know a flag, the server exposes it (e.g., `paymentsEnabled` in `/api/auth/user`).

To expose a flag to the client:
1. Add the boolean to the `AuthUserResponse` type in `packages/shared/src/api.ts`
2. Resolve it in `apps/server/src/lib/buildAuthUserResponse.ts` (the shared auth-user response builder used by `GET /api/auth/user` and all composite shells)
3. Client hooks (`useAuth.ts`) should read from the server response, never from a local env var

## Rollout/rollback patterns

### Safe rollout example (`ENABLE_SEMANTIC_SIMILARITY`)

1. Confirm staging has representative pool data.
2. Enable in staging: `ENABLE_SEMANTIC_SIMILARITY=true`.
3. Run matching stress simulation (`npm run test:matching:stress`) and check admin dashboard 🧠 语义匹配观测 panel for score shifts.
4. Monitor `joyjoin_matching_semantic_similarity_score` and `joyjoin_matching_semantic_pair_score_delta` in `/api/metrics`.
5. If deltas are within expected bounds, enable in production during a low-traffic window.
6. Keep the flag for at least one full event cycle before considering permanent enable.

### Kill-switch example (payment incident)

1. Set `PAYMENTS_ENABLED=false` in the environment and restart the server (or redeploy).
2. Verify `/api/readyz` still returns `200` (payment config validation skips when disabled).
3. Confirm `POST /api/payments/create` returns `503` with `code: "PAYMENTS_DISABLED"`.
4. Confirm the client (`BlindBoxPaymentPage`, mini-program `paymentEntry.ts`) shows the maintenance message instead of the payment UI.

## Adding a new feature flag

1. Add the env var read in the relevant server file (e.g., `process.env.MY_FEATURE_ENABLED === 'true'`).
2. Gate the route or service logic with a clear early return / fallback.
3. Document the flag in `docs/LAUNCH_CONFIG.md` or `docs/ai-feature-flags.md`.
4. Add the var (commented out or with safe default) to `.env.example` and `deployment/.env.staging.example`.
5. If the client needs the flag, expose it in `/api/auth/user` or a dedicated config endpoint.
6. Add a test that verifies both enabled and disabled paths.

## Backward compatibility when removing flags

If a flag is being retired, ensure the enabled behavior is the new default, update docs, and remove the env var from example files in the same PR.

## Canonical References

- `docs/LAUNCH_CONFIG.md` — canonical launch configuration guide
- `docs/ai-feature-flags.md` — AI-specific feature flags and environment variables
- `apps/server/src/lib/configValidation.ts` — startup config validation
- `apps/server/src/auth/policy.ts` — auth/debug flag policy
- `apps/server/src/matchingSemantic.ts` — `isSemanticSimilarityEnabled()`
- `apps/server/src/poolMatchingService.ts` — semantic similarity in matching pipeline
- `apps/server/src/socialIcebreakerPhaseConfig.ts` — icebreaker phase flag resolution
- `apps/server/src/socialIcebreakerAIService.ts` — `isAuctionLlmEnabled()`
- `apps/server/src/lib/miniscriptAgent.ts` — `isMiniscriptLlmEnabled()`
- `apps/server/src/eventThemeTitleGenerator.ts` — `ENABLE_EVENT_THEME_TITLE_GENERATION`
- `apps/server/src/routes/domains/payments.ts` — payment kill-switch middleware
- `apps/server/src/routes/domains/auth.ts` — `paymentsEnabled` in auth user response
- `apps/server/src/matchingMetrics.ts` — semantic similarity Prometheus metrics
- `packages/shared/src/api.ts` — shared API types including `paymentsEnabled`
